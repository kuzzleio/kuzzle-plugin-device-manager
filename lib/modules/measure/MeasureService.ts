import {
  Backend,
  BadRequestError,
  JSONObject,
  KDocument,
  NotFoundError,
  PluginContext,
} from "kuzzle";
import _ from "lodash";

import {
  DeviceManagerConfiguration,
  DeviceManagerPlugin,
  InternalCollection,
} from "../../core";
import { DeviceContent } from "./../device";
import {
  AskAssetHistoryAdd,
  AssetContent,
  AssetHistoryEventMeasure,
  AssetHistoryEventMetadata,
} from "../asset";
import { DigitalTwinContent, Metadata, lock, ask } from "../shared";
import { AssetSerializer } from "../asset";

import {
  EventMeasureIngest,
  EventMeasureProcessAfter,
  EventMeasureProcessBefore,
  TenantEventMeasureProcessAfter,
  TenantEventMeasureProcessBefore,
} from "./types/MeasureEvents";
import { DecodedMeasurement, MeasureContent } from "./types/MeasureContent";
import { ApiMeasurePushRequest } from "./types/MeasureApi";

export class MeasureService {
  private config: DeviceManagerConfiguration;
  private context: PluginContext;

  private get sdk() {
    return this.context.accessors.sdk;
  }

  private get app(): Backend {
    return global.app;
  }

  constructor(plugin: DeviceManagerPlugin) {
    this.config = plugin.config as any;
    this.context = plugin.context;

    this.app.pipe.register<EventMeasureIngest>(
      "device-manager:measures:ingest",
      async (payload) => {
        await this.ingest(
          payload.device,
          payload.measurements,
          payload.metadata,
          payload.payloadUuids
        );

        return payload;
      }
    );
  }

  /**
   * Register new measures from a device, updates :
   * - admin device
   * - engine device
   * - linked asset
   * - engine measures
   *
   * A mutex ensure that a device can ingest one measure at a time.
   *
   * This method represents the ingestion pipeline:
   *  - build measures documents and update digital twins (device and asset)
   *  - trigger events to enrich measures documents
   *  - save documents (measures, device and asset)
   *  - trigger events to trigger business rules
   */
  public async ingest(
    device: KDocument<DeviceContent>,
    measurements: DecodedMeasurement<JSONObject>[],
    metadata: Metadata,
    payloadUuids: string[]
  ) {
    await lock(`measure:ingest:${device._id}`, async () => {
      if (!measurements) {
        this.app.log.warn(
          `Cannot find measurements for device "${device._source.reference}"`
        );
        return;
      }

      const engineId = device._source.engineId;
      const asset = await this.tryGetLinkedAsset(
        engineId,
        device._source.assetId
      );
      const originalAssetMetadata =
        asset === null
          ? {}
          : JSON.parse(JSON.stringify(asset._source.metadata));

      _.merge(device._source.metadata, metadata);

      const measures = this.buildMeasures(
        device,
        asset,
        measurements,
        payloadUuids
      );

      /**
       * Event before starting to process new measures.
       *
       * Useful to enrich measures before they are saved.
       *
       * Only measures documents can be modified
       */
      let afterEnrichment = await this.app.trigger<EventMeasureProcessBefore>(
        "device-manager:measures:process:before",
        { asset, device, measures }
      );

      if (engineId) {
        afterEnrichment =
          await this.app.trigger<TenantEventMeasureProcessBefore>(
            `engine:${engineId}:device-manager:measures:process:before`,
            { asset, device, measures: afterEnrichment.measures }
          );
      }

      this.updateEmbeddedMeasures("device", device, afterEnrichment.measures);
      if (asset) {
        this.updateEmbeddedMeasures("asset", asset, afterEnrichment.measures);
      }

      const promises = [];

      promises.push(
        this.sdk.document
          .update<DeviceContent>(
            this.config.adminIndex,
            InternalCollection.DEVICES,
            device._id,
            device._source
          )
          .catch((error) => {
            throw new BadRequestError(
              `Cannot update device "${device._id}": ${error.message}`
            );
          })
      );

      if (engineId) {
        promises.push(
          this.sdk.document
            .update<DeviceContent>(
              engineId,
              InternalCollection.DEVICES,
              device._id,
              device._source
            )
            .catch((error) => {
              throw new BadRequestError(
                `Cannot update engine device "${device._id}": ${error.message}`
              );
            })
        );

        promises.push(
          this.sdk.document
            .mCreate<MeasureContent>(
              engineId,
              InternalCollection.MEASURES,
              afterEnrichment.measures.map((measure) => ({ body: measure }))
            )
            .then(({ errors }) => {
              if (errors.length !== 0) {
                throw new BadRequestError(
                  `Cannot save measures: ${errors[0].reason}`
                );
              }
            })
        );

        if (asset) {
          // @todo potential race condition if 2 differents device are linked
          // to the same asset and get processed at the same time
          // asset measures update could be protected by mutex
          promises.push(
            this.sdk.document
              .update<AssetContent>(
                engineId,
                InternalCollection.ASSETS,
                asset._id,
                asset._source
              )
              .then(async (updatedAsset) => {
                const event: AssetHistoryEventMeasure = {
                  measure: {
                    // Filter measures who are not in the asset device link
                    names: afterEnrichment.measures
                      .filter((m) => m.asset.measureName)
                      .map((m) => m.asset.measureName),
                  },
                  name: "measure",
                };

                const metadataDiff = this.compareMetadata(
                  originalAssetMetadata,
                  updatedAsset._source.metadata
                );
                if (metadataDiff.length !== 0) {
                  (event as unknown as AssetHistoryEventMetadata).metadata = {
                    names: metadataDiff,
                  };
                }

                await ask<AskAssetHistoryAdd<AssetHistoryEventMeasure>>(
                  "ask:device-manager:asset:history:add",
                  { asset: updatedAsset, engineId, event }
                );
              })
              .catch((error) => {
                throw new BadRequestError(
                  `Cannot update asset "${asset._id}": ${error.message}`
                );
              })
          );
        }
      }

      await Promise.all(promises);

      /**
       * Event at the end of the measure process pipeline.
       *
       * Useful to trigger business rules like alerts
       *
       * @todo test this
       */
      await this.app.trigger<EventMeasureProcessAfter>(
        "device-manager:measures:process:after",
        {
          asset,
          device,
          measures,
        }
      );

      if (engineId) {
        await this.app.trigger<TenantEventMeasureProcessAfter>(
          `engine:${engineId}:device-manager:measures:process:after`,
          { asset, device, measures }
        );
      }
    });
  }

  private compareMetadata(before: JSONObject, after: JSONObject): string[] {
    const names: string[] = [];

    for (const [key, value] of Object.entries(before)) {
      if (after[key] !== value) {
        names.push(key);
      }
    }

    return names;
  }

  /**
   * Updates embedded measures in a digital twin
   */
  private updateEmbeddedMeasures(
    type: "asset" | "device", // this is why typescript taste like half baked, there is no way to know types at runtime
    digitalTwin: KDocument<DigitalTwinContent>,
    measurements: MeasureContent[]
  ) {
    if (!digitalTwin._source.measures) {
      digitalTwin._source.measures = {};
    }

    for (const measurement of measurements) {
      const measureName =
        type === "asset"
          ? measurement.asset.measureName
          : measurement.origin.measureName;

      // The measure does not have a name in the asset because it was not defined
      // in the device link
      if (measureName === null) {
        continue;
      }

      const previousMeasure = digitalTwin._source.measures[measureName];

      if (
        previousMeasure &&
        previousMeasure.measuredAt > measurement.measuredAt
      ) {
        continue;
      }

      digitalTwin._source.measures[measureName] = {
        measuredAt: measurement.measuredAt,
        name: measureName,
        payloadUuids: measurement.origin.payloadUuids,
        type: measurement.type,
        values: measurement.values,
      };
    }
  }

  /**
   * Build the measures documents to save
   */
  private buildMeasures(
    device: KDocument<DeviceContent>,
    asset: KDocument<AssetContent> | null,
    measurements: DecodedMeasurement[],
    payloadUuids: string[]
  ): MeasureContent[] {
    const measures: MeasureContent[] = [];

    for (const measurement of measurements) {
      // @todo check if measure type exists
      const assetMeasureName = this.tryFindAssetMeasureName(
        device,
        asset,
        measurement.measureName
      );

      const measureContent: MeasureContent = {
        asset:
          asset === null
            ? undefined
            : AssetSerializer.measureContext(asset, assetMeasureName),
        measuredAt: measurement.measuredAt,
        origin: {
          _id: device._id,
          deviceModel: device._source.model,
          measureName: measurement.measureName,
          payloadUuids,
          reference: device._source.reference,
          type: "device",
        },
        type: measurement.type,
        values: measurement.values,
      };

      measures.push(measureContent);
    }

    return measures;
  }

  /**
   * Register new measures from a device, updates :
   * - linked asset
   * - engine measures
   *
   * The `measuredAt` of the measures will be set automatically if not setted
   *
   * @todo remove
   */
  public async registerByAsset(
    engineId: string,
    assetId: string,
    measureInfo: ApiMeasurePushRequest["body"]["measure"],
    kuid: string,
    { refresh }: { refresh?: any } = {}
  ): Promise<KDocument<AssetContent>> {
    return lock(`asset:${engineId}:${assetId}`, async () => {
      const asset = await this.tryGetLinkedAsset(engineId, assetId);

      if (!asset) {
        throw new NotFoundError(`Asset "${assetId}" does not exist`);
      }

      if (!measureInfo.type) {
        throw new BadRequestError(
          `Invalid measure for asset "${asset._id}": missing "type"`
        );
      }

      if (!measureInfo.name) {
        throw new BadRequestError(
          `Invalid measure for asset "${asset._id}": missing "name"`
        );
      }

      if (
        !measureInfo.values ||
        Object.keys(measureInfo.values || {}).length === 0
      ) {
        throw new BadRequestError(
          `Invalid measure for asset "${asset._id}": missing "values"`
        );
      }

      // @todo check if measure type exists

      const measure: MeasureContent = {
        asset: AssetSerializer.measureContext(asset, measureInfo.name),
        measuredAt: measureInfo.measuredAt || Date.now(),
        origin: {
          _id: kuid,
          measureName: measureInfo.name,
          type: "user",
        },
        type: measureInfo.type,
        values: measureInfo.values,
      };

      this.updateEmbeddedMeasures("asset", asset, [measure]);

      const [updatedAsset] = await Promise.all([
        this.sdk.document.update<AssetContent>(
          engineId,
          InternalCollection.ASSETS,
          asset._id,
          { measures: asset._source.measures },
          { refresh, source: true }
        ),
        this.sdk.document.create<MeasureContent>(
          engineId,
          InternalCollection.MEASURES,
          measure,
          null,
          { refresh }
        ),
      ]);

      return updatedAsset;
    });
  }

  private async tryGetLinkedAsset(
    engineId: string,
    assetId: string
  ): Promise<KDocument<AssetContent>> {
    if (!assetId) {
      return null;
    }

    try {
      const asset = await this.sdk.document.get<AssetContent>(
        engineId,
        InternalCollection.ASSETS,
        assetId
      );

      return asset;
    } catch (error) {
      this.app.log.error(`[${engineId}] Cannot find asset "${assetId}".`);

      return null;
    }
  }

  /**
   * Retrieve the measure name for the asset
   */
  private tryFindAssetMeasureName(
    device: KDocument<DeviceContent>,
    asset: KDocument<AssetContent>,
    deviceMeasureName: string
  ): string | null {
    if (!asset) {
      return null;
    }

    const deviceLink = asset._source.linkedDevices.find(
      (link) => link._id === device._id
    );

    if (!deviceLink) {
      throw new BadRequestError(
        `Device "${device._id}" is not linked to asset "${asset._id}"`
      );
    }

    const measureName = deviceLink.measureNames.find(
      (m) => m.device === deviceMeasureName
    );
    // The measure is decoded by the device but is not linked to the asset
    if (!measureName) {
      return null;
    }

    return measureName.asset;
  }
}
