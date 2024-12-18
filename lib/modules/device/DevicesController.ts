import {
  BadRequestError,
  ControllerDefinition,
  HttpStream,
  KuzzleError,
  KuzzleRequest,
} from "kuzzle";
import _ from "lodash";

import { AssetSerializer } from "../asset/model/AssetSerializer";
import { MeasureExporter, DecodedMeasurement } from "../measure";
import { DeviceManagerPlugin, InternalCollection } from "../plugin";
import { DigitalTwinExporter, EmbeddedMeasure } from "../shared";

import { DeviceService } from "./DeviceService";
import { DeviceSerializer } from "./model/DeviceSerializer";
import {
  ApiDeviceAttachEngineResult,
  ApiDeviceCreateResult,
  ApiDeviceDeleteResult,
  ApiDeviceDetachEngineResult,
  ApiDeviceGetResult,
  ApiDeviceLinkAssetRequest,
  ApiDeviceLinkAssetResult,
  ApiDeviceSearchResult,
  ApiDeviceUnlinkAssetResult,
  ApiDeviceUpdateResult,
  ApiDeviceGetMeasuresResult,
  ApiDeviceUpsertResult,
  ApiDeviceGetLastMeasuresResult,
  ApiDeviceMGetLastMeasuresResult,
  ApiDeviceGetLastMeasuredAtResult,
  ApiDeviceMGetLastMeasuredAtResult,
  ApiDeviceMetadataReplaceResult,
} from "./types/DeviceApi";

export class DevicesController {
  public definition: ControllerDefinition;
  private exporter: DigitalTwinExporter;
  private measureExporter: MeasureExporter;

  constructor(
    private plugin: DeviceManagerPlugin,
    private deviceService: DeviceService,
  ) {
    /* eslint-disable sort-keys */
    this.definition = {
      actions: {
        create: {
          handler: this.create.bind(this),
          http: [{ path: "device-manager/:engineId/devices", verb: "post" }],
        },
        get: {
          handler: this.get.bind(this),
          http: [
            { path: "device-manager/:engineId/devices/:_id", verb: "get" },
          ],
        },
        update: {
          handler: this.update.bind(this),
          http: [
            { path: "device-manager/:engineId/devices/:_id", verb: "put" },
          ],
        },
        upsert: {
          handler: this.upsert.bind(this),
          http: [{ path: "device-manager/:engineId/devices", verb: "put" }],
        },
        replaceMetadata: {
          handler: this.replaceMetadata.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/metadata",
              verb: "patch",
            },
          ],
        },
        search: {
          handler: this.search.bind(this),
          http: [
            { path: "device-manager/:engineId/devices/_search", verb: "post" },
          ],
        },
        delete: {
          handler: this.delete.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id",
              verb: "delete",
            },
          ],
        },
        attachEngine: {
          handler: this.attachEngine.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/_attach",
              verb: "put",
            },
          ],
        },
        detachEngine: {
          handler: this.detachEngine.bind(this),
          http: [
            { path: "device-manager/devices/:_id/_detach", verb: "delete" },
          ],
        },
        linkAsset: {
          handler: this.linkAsset.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/_link/:assetId",
              verb: "put",
            },
          ],
        },
        unlinkAsset: {
          handler: this.unlinkAsset.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/_unlink",
              verb: "delete",
            },
          ],
        },
        getMeasures: {
          handler: this.getMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/measures",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/devices/:_id/measures",
              verb: "post",
            },
          ],
        },
        getLastMeasures: {
          handler: this.getLastMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/lastMeasures",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/devices/:_id/lastMeasures",
              verb: "post",
            },
          ],
        },
        mGetLastMeasures: {
          handler: this.mGetLastMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/_mGetLastMeasures",
              verb: "post",
            },
          ],
        },
        exportMeasures: {
          handler: this.exportMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/measures/_export/:exportId",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/devices/:_id/measures/_export",
              verb: "post",
            },
          ],
        },
        receiveMeasures: {
          handler: this.receiveMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/measures",
              verb: "put",
            },
          ],
        },
        export: {
          handler: this.export.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/_export/:exportId",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/devices/_export",
              verb: "post",
            },
          ],
        },
        getLastMeasuredAt: {
          handler: this.getLastMeasuredAt.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/:_id/lastMeasuredAt",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/devices/:_id/lastMeasuredAt",
              verb: "post",
            },
          ],
        },
        mGetLastMeasuredAt: {
          handler: this.mGetLastMeasuredAt.bind(this),
          http: [
            {
              path: "device-manager/:engineId/devices/_mGetLastMeasuredAt",
              verb: "post",
            },
          ],
        },
      },
    };
    /* eslint-enable sort-keys */

    this.exporter = new DigitalTwinExporter(
      this.plugin,
      InternalCollection.DEVICES,
    );
    this.measureExporter = new MeasureExporter(
      this.plugin,
      InternalCollection.DEVICES,
    );
  }

  async get(request: KuzzleRequest): Promise<ApiDeviceGetResult> {
    const deviceId = request.getId();
    const engineId = request.getString("engineId");

    const device = await this.deviceService.get(engineId, deviceId, request);

    return DeviceSerializer.serialize(device);
  }

  async update(request: KuzzleRequest): Promise<ApiDeviceUpdateResult> {
    const deviceId = request.getId();
    const engineId = request.getString("engineId");
    const metadata = request.getBodyObject("metadata");

    const updatedDevice = await this.deviceService.update(
      engineId,
      deviceId,
      metadata,
      request,
    );

    return DeviceSerializer.serialize(updatedDevice);
  }
  async replaceMetadata(
    request: KuzzleRequest,
  ): Promise<ApiDeviceMetadataReplaceResult> {
    const deviceId = request.getId();
    const engineId = request.getString("engineId");
    const metadata = request.getBodyObject("metadata");

    const updatedDevice = await this.deviceService.replaceMetadata(
      engineId,
      deviceId,
      metadata,
      request,
    );

    return DeviceSerializer.serialize(updatedDevice);
  }
  async delete(request: KuzzleRequest): Promise<ApiDeviceDeleteResult> {
    const engineId = request.getString("engineId");
    const deviceId = request.getId();

    await this.deviceService.delete(engineId, deviceId, request);
  }

  async search(request: KuzzleRequest): Promise<ApiDeviceSearchResult> {
    return this.deviceService.search(
      request.getString("engineId"),
      request.getSearchParams(),
      request,
    );
  }

  async upsert(request: KuzzleRequest): Promise<ApiDeviceUpsertResult> {
    const engineId = request.getString("engineId");
    const model = request.getBodyString("model");
    const reference = request.getBodyString("reference");
    const metadata = request.getBodyObject("metadata");

    const upsertDevice = await this.deviceService.upsert(
      engineId,
      model,
      reference,
      metadata,
      request,
    );

    return DeviceSerializer.serialize(upsertDevice);
  }

  /**
   * Create and provision a new device
   */
  async create(request: KuzzleRequest): Promise<ApiDeviceCreateResult> {
    const model = request.getBodyString("model");
    const reference = request.getBodyString("reference");
    const metadata = request.getBodyObject("metadata", {});

    const device = await this.deviceService.create(
      model,
      reference,
      metadata,
      request,
    );

    return DeviceSerializer.serialize(device);
  }

  /**
   * Attach a device to a tenant
   */
  async attachEngine(
    request: KuzzleRequest,
  ): Promise<ApiDeviceAttachEngineResult> {
    const engineId = request.getString("engineId");
    const deviceId = request.getId();

    await this.deviceService.attachEngine(engineId, deviceId, request);
  }

  /**
   * Detach a device from it's tenant
   */
  async detachEngine(
    request: KuzzleRequest,
  ): Promise<ApiDeviceDetachEngineResult> {
    const deviceId = request.getId();

    await this.deviceService.detachEngine(deviceId, request);
  }

  /**
   * Link a device to an asset.
   */
  async linkAsset(request: KuzzleRequest): Promise<ApiDeviceLinkAssetResult> {
    const deviceId = request.getId();
    const engineId = request.getString("engineId");
    const assetId = request.getString("assetId");
    const measureNames = request.getBodyArray(
      "measureNames",
      [],
    ) as ApiDeviceLinkAssetRequest["body"]["measureNames"];
    const implicitMeasuresLinking = request.getBoolean(
      "implicitMeasuresLinking",
    );

    if (measureNames.length === 0 && !implicitMeasuresLinking) {
      throw new BadRequestError(
        `You must provide at least one measure name or set "implicitMeasuresLinking" to true.`,
      );
    }

    const { asset, device } = await this.deviceService.linkAsset(
      engineId,
      deviceId,
      assetId,
      measureNames,
      implicitMeasuresLinking,
      request,
    );

    return {
      asset: AssetSerializer.serialize(asset),
      device: DeviceSerializer.serialize(device),
    };
  }

  /**
   * Unlink a device from an asset.
   */
  async unlinkAsset(
    request: KuzzleRequest,
  ): Promise<ApiDeviceUnlinkAssetResult> {
    const deviceId = request.getId();

    const { asset, device } = await this.deviceService.unlinkAsset(
      deviceId,
      request,
    );

    return {
      asset: AssetSerializer.serialize(asset),
      device: DeviceSerializer.serialize(device),
    };
  }

  async getMeasures(
    request: KuzzleRequest,
  ): Promise<ApiDeviceGetMeasuresResult> {
    const id = request.getId();
    const engineId = request.getString("engineId");
    const size = request.input.args.size;
    const from = request.input.args.from;
    const startAt = request.input.args.startAt
      ? request.getDate("startAt")
      : null;
    const endAt = request.input.args.endAt ? request.getDate("endAt") : null;
    const query = request.input.body?.query;
    const sort = request.input.body?.sort;
    const type = request.input.args.type;
    const lang = request.getLangParam();

    const { measures, total } = await this.measureExporter.search(
      engineId,
      {
        endAt,
        id,
        lang,
        query,
        sort,
        startAt,
        type,
      },
      { from, size },
    );

    return { measures, total };
  }

  async getLastMeasures(
    request: KuzzleRequest,
  ): Promise<ApiDeviceGetLastMeasuresResult> {
    const deviceId = request.getId();
    const engineId = request.getString("engineId");
    const measureCount = request.getNumber("measureCount", 100);

    const results = await this.deviceService.getLastMeasures(
      engineId,
      deviceId,
      measureCount,
    );

    return results.reduce<ApiDeviceGetLastMeasuresResult>(
      (accumulator, result) => {
        if (result.origin.type !== "device") {
          return accumulator;
        }

        const measure: EmbeddedMeasure = {
          measuredAt: result.measuredAt,
          name: result.origin.measureName,
          originId: result.origin._id,
          payloadUuids: result.origin.payloadUuids,
          type: result.type,
          values: result.values,
        };

        return {
          ...accumulator,
          [result.origin.measureName]: measure,
        };
      },
      {},
    );
  }

  async mGetLastMeasures(
    request: KuzzleRequest,
  ): Promise<ApiDeviceMGetLastMeasuresResult> {
    const engineId = request.getString("engineId");
    const measureCount = request.getNumber("measureCount", 100);
    const deviceIds = request.getBodyArray("ids");

    const results = await this.deviceService.mGetLastMeasures(
      engineId,
      deviceIds,
      measureCount,
    );

    const response: ApiDeviceMGetLastMeasuresResult = {};

    for (const [deviceId, measures] of Object.entries(results)) {
      response[deviceId] = measures.reduce<ApiDeviceGetLastMeasuresResult>(
        (accumulator, result) => {
          if (result.origin.type !== "device") {
            return accumulator;
          }

          const measure: EmbeddedMeasure = {
            measuredAt: result.measuredAt,
            name: result.origin.measureName,
            originId: result.origin._id,
            payloadUuids: result.origin.payloadUuids,
            type: result.type,
            values: result.values,
          };

          return {
            ...accumulator,
            [result.origin.measureName]: measure,
          };
        },
        {},
      );
    }

    return response;
  }

  async exportMeasures(request: KuzzleRequest) {
    const engineId = request.getString("engineId");

    if (
      request.context.connection.protocol === "http" &&
      request.context.connection.misc.verb === "GET"
    ) {
      try {
        const exportId = request.getString("exportId");

        const { id } = await this.measureExporter.getExport(engineId, exportId);
        const stream = await this.measureExporter.sendExport(
          engineId,
          exportId,
        );

        request.response.configure({
          headers: {
            "Content-Disposition": `attachment; filename="device-${id}.csv"`,
            "Content-Type": "text/csv",
          },
        });

        return new HttpStream(stream);
      } catch (error) {
        // ? Like this endpoint is mostly called by browser prefer return raw message for essyier readable error
        request.response.configure({
          format: "raw",
          headers: {
            "Content-Type": "text/plain",
          },
          status: (error as KuzzleError).status,
        });

        return error.message;
      }
    }

    const id = request.getId();
    const startAt = request.input.args.startAt
      ? request.getDate("startAt")
      : null;
    const endAt = request.input.args.endAt ? request.getDate("endAt") : null;
    const query = request.input.body?.query;
    const sort = request.input.body?.sort;
    const type = request.input.args.type;
    const lang = request.getLangParam();

    const link = await this.measureExporter.prepareExport(
      engineId,
      request.getUser(),
      {
        endAt,
        id,
        lang,
        query,
        sort,
        startAt,
        type,
      },
    );

    return { link };
  }

  async receiveMeasures(request: KuzzleRequest) {
    const engineId = request.getString("engineId");
    const deviceId = request.getId();
    const measures = request.getBodyArray("measures") as DecodedMeasurement[];
    const payloadUuids = request.getBodyArray("payloadUuids", []);

    if (payloadUuids.length === 0) {
      payloadUuids.push(request.id);
    }

    for (let i = 0; i < measures.length; i++) {
      if (typeof measures[i].measureName !== "string") {
        throw new BadRequestError(
          `body.measures[${i}].measureName must be a string`,
        );
      }

      if (typeof measures[i].measuredAt === "undefined") {
        measures[i].measuredAt = Date.now();
      } else if (typeof measures[i].measuredAt !== "number") {
        throw new BadRequestError(
          `body.measures[${i}].measuredAt must be a number`,
        );
      }

      if (typeof measures[i].type !== "string") {
        throw new BadRequestError(`body.measures[${i}].type must be a string`);
      }

      if (!_.isPlainObject(measures[i].values)) {
        throw new BadRequestError(
          `body.measures[${i}].values must be an object`,
        );
      }
    }

    await this.deviceService.receiveMeasures(
      engineId,
      deviceId,
      measures,
      payloadUuids,
      request,
    );
  }

  async export(request: KuzzleRequest) {
    const engineId = request.getString("engineId");

    if (
      request.context.connection.protocol === "http" &&
      request.context.connection.misc.verb === "GET"
    ) {
      try {
        const exportId = request.getString("exportId");
        const stream = await this.exporter.sendExport(engineId, exportId);

        request.response.configure({
          headers: {
            "Content-Disposition": `attachment; filename="${InternalCollection.DEVICES}.csv"`,
            "Content-Type": "text/csv",
          },
        });

        return new HttpStream(stream);
      } catch (error) {
        // ? Like this endpoint is mostly called by browser prefer return raw message for essyier readable error
        request.response.configure({
          format: "raw",
          headers: {
            "Content-Type": "text/plain",
          },
          status: (error as KuzzleError).status,
        });

        return error.message;
      }
    }

    const query = request.input.body?.query;
    const sort = request.input.body?.sort;
    const lang = request.getLangParam();

    const link = await this.exporter.prepareExport(
      engineId,
      request.getUser(),
      {
        lang,
        query,
        sort,
      },
    );

    return { link };
  }

  async getLastMeasuredAt(
    request: KuzzleRequest,
  ): Promise<ApiDeviceGetLastMeasuredAtResult> {
    const deviceId = request.getId();
    const engineId = request.getString("engineId");

    const lastMeasuredAt = await this.deviceService.getLastMeasuredAt(
      engineId,
      deviceId,
    );

    return {
      lastMeasuredAt,
    };
  }

  async mGetLastMeasuredAt(
    request: KuzzleRequest,
  ): Promise<ApiDeviceMGetLastMeasuredAtResult> {
    const engineId = request.getString("engineId");
    const deviceIds = request.getBodyArray("ids");

    return this.deviceService.mGetLastMeasuredAt(engineId, deviceIds);
  }
}
