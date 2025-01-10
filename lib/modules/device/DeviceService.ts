import { BadRequestError, KuzzleRequest } from "kuzzle";
import { ask, onAsk } from "kuzzle-plugin-commons";
import {
  BaseRequest,
  DocumentSearchResult,
  JSONObject,
  KDocument,
  KHit,
  SearchResult,
} from "kuzzle-sdk";

import { DecodedMeasurement } from "../measure";
import {
  AskModelAssetGet,
  AskModelDeviceGet,
  AssetModelContent,
  DeviceModelContent,
} from "../model";
import {
  AskEngineList,
  DeviceManagerPlugin,
  InternalCollection,
} from "../plugin";
import { DigitalTwinService, Metadata, SearchParams, lock } from "../shared";
import {
  AskAssetHistoryAdd,
  AssetContent,
  AssetHistoryEventLink,
  AssetHistoryEventUnlink,
} from "./../asset";

import { AskPayloadReceiveFormated } from "../decoder/types/PayloadEvents";
import { DeviceSerializer } from "./model/DeviceSerializer";
import { ApiDeviceLinkAssetRequest } from "./types/DeviceApi";
import { DeviceContent } from "./types/DeviceContent";
import {
  AskDeviceAttachEngine,
  AskDeviceDetachEngine,
  AskDeviceLinkAsset,
  AskDeviceRefreshModel,
  AskDeviceUnlinkAsset,
  EventDeviceUpdateAfter,
  EventDeviceUpdateBefore,
} from "./types/DeviceEvents";
import _ from "lodash";

type MeasureName = { asset: string; device: string; type: string };

export class DeviceService extends DigitalTwinService {
  constructor(plugin: DeviceManagerPlugin) {
    super(plugin, InternalCollection.DEVICES);
  }

  override registerAskEvents() {
    super.registerAskEvents();

    onAsk<AskDeviceLinkAsset>(
      "ask:device-manager:device:link-asset",
      async ({ deviceId, engineId, user, assetId, measureNames }) => {
        const request = new KuzzleRequest({ refresh: "false" }, { user });
        await this.linkAsset(
          engineId,
          deviceId,
          assetId,
          measureNames,
          false,
          request,
        );
      },
    );

    onAsk<AskDeviceUnlinkAsset>(
      "ask:device-manager:device:unlink-asset",
      async ({ deviceId, user }) => {
        const request = new KuzzleRequest({ refresh: "false" }, { user });
        await this.unlinkAsset(deviceId, request);
      },
    );

    onAsk<AskDeviceDetachEngine>(
      "ask:device-manager:device:detach-engine",
      async ({ deviceId, user }) => {
        const request = new KuzzleRequest({ refresh: "false" }, { user });
        await this.detachEngine(deviceId, request);
      },
    );

    onAsk<AskDeviceAttachEngine>(
      "ask:device-manager:device:attach-engine",
      async ({ deviceId, engineId, user }) => {
        const request = new KuzzleRequest({ refresh: "false" }, { user });
        await this.attachEngine(engineId, deviceId, request);
      },
    );

    onAsk<AskDeviceRefreshModel>(
      "ask:device-manager:device:refresh-model",
      this.refreshModel.bind(this),
    );
  }

  /**
   * Create a new device.
   *
   * @todo creating a device in the "device-manager" index should be a separate
   * method since in this case "engineId" is not really an engine ID but still
   * required as an argument (in part to check the tenant rights)
   */
  async create(
    model: string,
    reference: string,
    metadata: JSONObject,
    request: KuzzleRequest,
  ): Promise<KDocument<DeviceContent>> {
    let device: KDocument<DeviceContent> = {
      _id: DeviceSerializer.id(model, reference),
      _source: {
        assetId: null,
        engineId: null,
        lastMeasuredAt: 0,
        measureSlots: [],
        measures: {},
        metadata,
        model,
        reference,
      },
    };

    return lock(`device:create:${device._id}`, async () => {
      const deviceModel = await this.getDeviceModel(model);
      const engineId = request.getString("engineId");

      device._source.measureSlots = deviceModel.device.measures;

      for (const metadataName of Object.keys(
        deviceModel.device.metadataMappings,
      )) {
        device._source.metadata[metadataName] ||= null;
      }
      for (const [metadataName, metadataValue] of Object.entries(
        deviceModel.device.defaultMetadata,
      )) {
        _.set(device._source.metadata, metadataName, metadataValue);
      }

      const refreshableCollections: Array<{
        index: string;
        collection: string;
      }> = [];

      const { _source } = await this.createDocument<DeviceContent>(
        request,
        device,
        {
          collection: InternalCollection.DEVICES,
          engineId: this.config.adminIndex,
        },
      );

      device._source = _source;

      refreshableCollections.push({
        collection: InternalCollection.DEVICES,
        index: this.config.adminIndex,
      });

      if (engineId && engineId !== this.config.adminIndex) {
        device = await this.attachEngine(engineId, device._id, request);

        refreshableCollections.push({
          collection: InternalCollection.DEVICES,
          index: engineId,
        });
      }

      if (request.getRefresh() === "wait_for") {
        await Promise.all(
          refreshableCollections.map(({ index, collection }) =>
            this.sdk.collection.refresh(index, collection),
          ),
        );
      }

      return device;
    });
  }

  public async get(
    engineId: string,
    deviceId: string,
    request: KuzzleRequest,
  ): Promise<KDocument<DeviceContent>> {
    return this.getDocument<DeviceContent>(request, deviceId, {
      collection: InternalCollection.DEVICES,
      engineId,
    });
  }

  private async getInternalDevices(deviceId: string) {
    return this.sdk.document.get<DeviceContent>(
      this.config.adminIndex,
      InternalCollection.DEVICES,
      deviceId,
    );
  }
  /**
   * Replace a device metadata
   */
  public async replaceMetadata(
    engineId: string,
    deviceId: string,
    metadata: Metadata,
    request: KuzzleRequest,
  ): Promise<KDocument<DeviceContent>> {
    const device = await this.get(engineId, deviceId, request);

    for (const key in metadata) {
      if (key in device._source.metadata) {
        device._source.metadata[key] = metadata[key];
      }
    }

    const updatedPayload = await this.app.trigger<EventDeviceUpdateBefore>(
      "device-manager:device:update:before",
      { device: device, metadata },
    );

    const updatedDevice = await this.sdk.document.replace<DeviceContent>(
      engineId,
      InternalCollection.DEVICES,
      deviceId,
      updatedPayload.device._source,
    );

    await this.app.trigger<EventDeviceUpdateAfter>(
      "device-manager:device:update:after",
      {
        device: updatedDevice,
        metadata: updatedPayload.metadata,
      },
    );

    return updatedDevice;
  }

  /**
   * Update or Create an device metadata
   */
  public async upsert(
    engineId: string,
    model: string,
    reference: string,
    metadata: Metadata,
    request: KuzzleRequest,
  ): Promise<KDocument<DeviceContent>> {
    const deviceId = `${model}-${reference}`;
    return lock(`device:${engineId}:${deviceId}`, async () => {
      const adminIndexDevice = await this.get(
        this.config.adminIndex,
        deviceId,
        request,
      ).catch(() => null);

      if (!adminIndexDevice) {
        return this.create(model, reference, metadata, request);
      }

      if (
        adminIndexDevice._source.engineId &&
        adminIndexDevice._source.engineId !== engineId
      ) {
        throw new BadRequestError(
          `Device "${adminIndexDevice._id}" already exists on another engine. Abort`,
        );
      }

      const engineDevice = await this.get(engineId, deviceId, request).catch(
        () => null,
      );

      if (!engineDevice) {
        await this.attachEngine(engineId, deviceId, request);
      }

      const updatedPayload = await this.app.trigger<EventDeviceUpdateBefore>(
        "device-manager:device:update:before",
        { device: adminIndexDevice, metadata },
      );

      const updatedDevice = await this.updateDocument<DeviceContent>(
        request,
        {
          _id: deviceId,
          _source: { metadata: updatedPayload.metadata },
        },
        {
          collection: InternalCollection.DEVICES,
          engineId,
        },
        { source: true },
      );

      await this.app.trigger<EventDeviceUpdateAfter>(
        "device-manager:device:update:after",
        {
          device: updatedDevice,
          metadata: updatedPayload.metadata,
        },
      );

      return updatedDevice;
    });
  }

  public async update(
    engineId: string,
    deviceId: string,
    metadata: Metadata,
    request: KuzzleRequest,
  ): Promise<KDocument<DeviceContent>> {
    return lock<KDocument<DeviceContent>>(
      `device:update:${deviceId}`,
      async () => {
        const device = await this.get(engineId, deviceId, request);

        const updatedPayload = await this.app.trigger<EventDeviceUpdateBefore>(
          "device-manager:device:update:before",
          { device, metadata },
        );

        const updatedDevice = await this.updateDocument<DeviceContent>(
          request,
          {
            _id: deviceId,
            _source: { metadata: updatedPayload.metadata },
          },
          { collection: InternalCollection.DEVICES, engineId },
          { source: true },
        );

        await this.app.trigger<EventDeviceUpdateAfter>(
          "device-manager:device:update:after",
          {
            device: updatedDevice,
            metadata: updatedPayload.metadata,
          },
        );

        return updatedDevice;
      },
    );
  }

  public async delete(
    engineId: string,
    deviceId: string,
    request: KuzzleRequest,
  ) {
    return lock<void>(`device:delete:${deviceId}`, async () => {
      const device = await this.get(engineId, deviceId, request);

      const promises = [];

      if (device._source.assetId) {
        const asset = await this.sdk.document.get<AssetContent>(
          engineId,
          InternalCollection.ASSETS,
          device._source.assetId,
        );

        const linkedDevices = asset._source.linkedDevices.filter(
          (link) => link._id !== device._id,
        );

        promises.push(
          // Potential race condition if someone update the asset linkedDevices
          // at the same time (e.g link or unlink asset)
          this.updateDocument<AssetContent>(
            request,
            {
              _id: device._source.assetId,
              _source: { linkedDevices },
            },
            { collection: InternalCollection.ASSETS, engineId },
          ).then(async (updatedAsset) => {
            const event: AssetHistoryEventUnlink = {
              name: "unlink",
              unlink: {
                deviceId,
              },
            };

            await ask<AskAssetHistoryAdd<AssetHistoryEventUnlink>>(
              "ask:device-manager:asset:history:add",
              {
                engineId,
                histories: [
                  {
                    asset: updatedAsset._source,
                    event,
                    id: updatedAsset._id,
                    timestamp: Date.now(),
                  },
                ],
              },
            );
          }),
        );
      }

      promises.push(
        this.deleteDocument(request, deviceId, {
          collection: InternalCollection.DEVICES,
          engineId: this.config.adminIndex,
        }),
      );

      promises.push(
        this.deleteDocument(request, deviceId, {
          collection: InternalCollection.DEVICES,
          engineId,
        }),
      );

      await Promise.all(promises);
    });
  }

  public async search(
    engineId: string,
    searchParams: SearchParams,
    request: KuzzleRequest,
  ): Promise<SearchResult<KHit<DeviceContent>>> {
    return this.searchDocument<DeviceContent>(request, searchParams, {
      collection: InternalCollection.DEVICES,
      engineId,
    });
  }

  /**
   * Attach the device to an engine
   *
   * @param engineId Engine id to attach to
   * @param deviceId Device id to attach
   * @param options.refresh Wait for ES indexation
   * @param options.strict If true, throw if an operation isn't possible
   */
  async attachEngine(
    engineId: string,
    deviceId: string,
    request: KuzzleRequest,
  ): Promise<KDocument<DeviceContent>> {
    return lock(`device:attachEngine:${deviceId}`, async () => {
      const device = await this.getInternalDevices(deviceId);

      if (device._source.engineId) {
        throw new BadRequestError(
          `Device "${device._id}" is already attached to an engine.`,
        );
      }

      await this.checkEngineExists(engineId);

      device._source.engineId = engineId;

      await this.updateDocument<DeviceContent>(request, device, {
        collection: InternalCollection.DEVICES,
        engineId: this.config.adminIndex,
      });

      // Make sure the device is cleaned when attached to tenant
      device._source.lastMeasuredAt = null;
      device._source.measures = {};

      const updatedDevice = await this.createDocument<DeviceContent>(
        request,
        device,
        {
          collection: InternalCollection.DEVICES,
          engineId,
        },
      );

      if (request.getRefresh() === "wait_for") {
        await Promise.all([
          this.sdk.collection.refresh(
            this.config.adminIndex,
            InternalCollection.DEVICES,
          ),
          this.sdk.collection.refresh(
            device._source.engineId,
            InternalCollection.DEVICES,
          ),
        ]);
      }

      return updatedDevice;
    });
  }

  /**
   * Detach a device from its attached engine
   *
   * @param {string} deviceId Id of the device
   * @param {KuzzleRequest} request kuzzle request
   */
  async detachEngine(
    deviceId: string,
    request: KuzzleRequest,
  ): Promise<KDocument<DeviceContent>> {
    return lock(`device:detachEngine:${deviceId}`, async () => {
      const device = await this.getInternalDevices(deviceId);

      this.checkAttachedToEngine(device);

      if (device._source.assetId) {
        await this.unlinkAsset(deviceId, request);
      }

      await Promise.all([
        this.updateDocument<DeviceContent>(
          request,
          {
            _id: device._id,
            _source: { engineId: null },
          },
          {
            collection: InternalCollection.DEVICES,
            engineId: this.config.adminIndex,
          },
        ),

        this.sdk.document.delete(
          device._source.engineId,
          InternalCollection.DEVICES,
          device._id,
        ),
      ]);

      if (request.getRefresh() === "wait_for") {
        await Promise.all([
          this.sdk.collection.refresh(
            this.config.adminIndex,
            InternalCollection.DEVICES,
          ),
          this.sdk.collection.refresh(
            device._source.engineId,
            InternalCollection.DEVICES,
          ),
        ]);
      }

      return device;
    });
  }

  /**
   * Link a device to an asset.
   */
  async linkAsset(
    engineId: string,
    deviceId: string,
    assetId: string,
    measureNames: ApiDeviceLinkAssetRequest["body"]["measureNames"],
    implicitMeasuresLinking: boolean,
    request: KuzzleRequest,
  ): Promise<{
    asset: KDocument<AssetContent>;
    device: KDocument<DeviceContent>;
  }> {
    return lock(`device:linkAsset:${deviceId}`, async () => {
      const device = await this.getInternalDevices(deviceId);
      const engine = await this.getEngine(engineId);

      this.checkAttachedToEngine(device);

      if (device._source.engineId !== engineId) {
        throw new BadRequestError(
          `Device "${device._id}" is not attached to the specified engine.`,
        );
      }

      if (device._source.assetId && device._source.assetId !== assetId) {
        throw new BadRequestError(
          `Device "${device._id}" is already linked to another asset.`,
        );
      }

      const asset = await this.sdk.document.get<AssetContent>(
        device._source.engineId,
        InternalCollection.ASSETS,
        assetId,
      );

      // Remove existing links for this device
      asset._source.linkedDevices = asset._source.linkedDevices.filter(
        (link) => {
          return link._id !== deviceId;
        },
      );

      const [assetModel, deviceModel] = await Promise.all([
        this.getAssetModel(engine.group, asset._source.model),
        this.getDeviceModel(device._source.model),
      ]);

      const updatedMeasureNames: MeasureName[] = [];
      for (const measure of measureNames) {
        const foundMeasure = deviceModel.device.measures.find(
          (deviceMeasure) => deviceMeasure.name === measure.device,
        );
        if (!foundMeasure && !implicitMeasuresLinking) {
          throw new BadRequestError(
            `Measure "${measure.asset}" is not declared in the device model "${measure.device}".`,
          );
        }
        const { type } = foundMeasure;
        updatedMeasureNames.push({
          asset: measure.asset,
          device: measure.device,
          type,
        });
      }

      this.checkAlreadyProvidedMeasures(asset, updatedMeasureNames);

      if (implicitMeasuresLinking) {
        this.generateMissingAssetMeasureNames(
          asset,
          assetModel,
          deviceModel,
          updatedMeasureNames,
        );
      }

      device._source.assetId = assetId;
      asset._source.linkedDevices.push({
        _id: deviceId,
        measureNames: updatedMeasureNames,
      });

      const [updatedDevice, , updatedAsset] = await Promise.all([
        this.updateDocument<DeviceContent>(
          request,
          device,
          {
            collection: InternalCollection.DEVICES,
            engineId: this.config.adminIndex,
          },
          { source: true },
        ),

        this.updateDocument<DeviceContent>(request, device, {
          collection: InternalCollection.DEVICES,
          engineId: device._source.engineId,
        }),

        this.updateDocument<AssetContent>(
          request,
          asset,
          {
            collection: InternalCollection.ASSETS,
            engineId: device._source.engineId,
          },
          { source: true },
        ),
      ]);

      const event: AssetHistoryEventLink = {
        link: {
          deviceId: device._id,
        },
        name: "link",
      };
      await ask<AskAssetHistoryAdd<AssetHistoryEventLink>>(
        "ask:device-manager:asset:history:add",
        {
          engineId,
          histories: [
            {
              asset: updatedAsset._source,
              event,
              id: updatedAsset._id,
              timestamp: Date.now(),
            },
          ],
        },
      );

      if (request.getRefresh() === "wait_for") {
        await Promise.all([
          this.sdk.collection.refresh(
            this.config.adminIndex,
            InternalCollection.DEVICES,
          ),
          this.sdk.collection.refresh(
            device._source.engineId,
            InternalCollection.DEVICES,
          ),
          this.sdk.collection.refresh(
            device._source.engineId,
            InternalCollection.ASSETS,
          ),
        ]);
      }

      return { asset: updatedAsset, device: updatedDevice };
    });
  }

  async receiveMeasures(
    engineId: string,
    deviceId: string,
    measures: DecodedMeasurement[],
    payloadUuids: string[],
    request: KuzzleRequest,
  ) {
    const device = await this.get(engineId, deviceId, request);
    const deviceModel = await this.getDeviceModel(device._source.model);

    for (const measure of measures) {
      const declaredMeasure = deviceModel.device.measures.some(
        (m) => m.name === measure.measureName && m.type === measure.type,
      );

      if (!declaredMeasure) {
        throw new BadRequestError(
          `Measure "${measure.measureName}" is not declared for this device model.`,
        );
      }
    }

    await ask<AskPayloadReceiveFormated>(
      "ask:device-manager:payload:receive-formated",
      {
        device,
        measures,
        payloadUuids,
      },
    );
  }

  /**
   * Checks if the asset does not already have a linked device using one of the
   * requested measure names.
   */
  private checkAlreadyProvidedMeasures(
    asset: KDocument<AssetContent>,
    requestedMeasureNames: MeasureName[],
  ) {
    const measureAlreadyProvided = (assetMeasureName: string): boolean => {
      return asset._source.linkedDevices.some((link) =>
        link.measureNames.some((names) => names.asset === assetMeasureName),
      );
    };

    for (const name of requestedMeasureNames) {
      if (measureAlreadyProvided(name.asset)) {
        throw new BadRequestError(
          `Measure name "${name.asset}" is already provided by another device on this asset.`,
        );
      }
    }
  }

  /**
   * Goes through the device available measures and add them into the link if:
   *  - they are not already provided by another device
   *  - they are not already present in the link request
   *  - they are declared in the asset model
   */
  private generateMissingAssetMeasureNames(
    asset: KDocument<AssetContent>,
    assetModel: AssetModelContent,
    deviceModel: DeviceModelContent,
    requestedMeasureNames: MeasureName[],
  ) {
    const measureAlreadyProvided = (deviceMeasureName: string): boolean => {
      return asset._source.linkedDevices.some((link) =>
        link.measureNames.some((names) => names.device === deviceMeasureName),
      );
    };

    const measureAlreadyRequested = (deviceMeasureName: string): boolean => {
      return requestedMeasureNames.some(
        (names) => names.device === deviceMeasureName,
      );
    };

    const measureUndeclared = (deviceMeasureName: string): boolean => {
      return !assetModel.asset.measures.some(
        (measure) => measure.name === deviceMeasureName,
      );
    };

    for (const deviceMeasure of deviceModel.device.measures) {
      if (
        measureAlreadyRequested(deviceMeasure.name) ||
        measureAlreadyProvided(deviceMeasure.name) ||
        measureUndeclared(deviceMeasure.name)
      ) {
        continue;
      }

      requestedMeasureNames.push({
        asset: deviceMeasure.name,
        device: deviceMeasure.name,
        type: deviceMeasure.type,
      });
    }
  }

  /**
   * Unlink a device of an asset
   *
   * @param {string} deviceId Id of the device
   * @param {KuzzleRequest} request kuzzle request
   */
  async unlinkAsset(
    deviceId: string,
    request: KuzzleRequest,
  ): Promise<{
    asset: KDocument<AssetContent>;
    device: KDocument<DeviceContent>;
  }> {
    return lock(`device:unlinkAsset:${deviceId}`, async () => {
      const device = await this.getInternalDevices(deviceId);
      const engineId = device._source.engineId;

      this.checkAttachedToEngine(device);

      if (!device._source.assetId) {
        throw new BadRequestError(
          `Device "${device._id}" is not linked to an asset.`,
        );
      }

      const asset = await this.sdk.document.get<AssetContent>(
        engineId,
        InternalCollection.ASSETS,
        device._source.assetId,
      );

      const linkedDevices = asset._source.linkedDevices.filter(
        (link) => link._id !== device._id,
      );

      const [updatedDevice, , updatedAsset] = await Promise.all([
        this.updateDocument<DeviceContent>(
          request,
          { _id: device._id, _source: { assetId: null } },
          {
            collection: InternalCollection.DEVICES,
            engineId: this.config.adminIndex,
          },
          { source: true },
        ),

        this.updateDocument<DeviceContent>(
          request,
          { _id: device._id, _source: { assetId: null } },
          {
            collection: InternalCollection.DEVICES,
            engineId,
          },
        ),

        this.updateDocument<AssetContent>(
          request,
          { _id: asset._id, _source: { linkedDevices } },
          {
            collection: InternalCollection.ASSETS,
            engineId,
          },
          { source: true },
        ),
      ]);

      const event: AssetHistoryEventUnlink = {
        name: "unlink",
        unlink: {
          deviceId,
        },
      };
      await ask<AskAssetHistoryAdd<AssetHistoryEventUnlink>>(
        "ask:device-manager:asset:history:add",
        {
          engineId,
          histories: [
            {
              asset: updatedAsset._source,
              event,
              id: updatedAsset._id,
              timestamp: Date.now(),
            },
          ],
        },
      );

      if (request.getRefresh() === "wait_for") {
        await Promise.all([
          this.sdk.collection.refresh(
            this.config.adminIndex,
            InternalCollection.DEVICES,
          ),
          this.sdk.collection.refresh(engineId, InternalCollection.DEVICES),
          this.sdk.collection.refresh(engineId, InternalCollection.ASSETS),
        ]);
      }

      return { asset: updatedAsset, device: updatedDevice };
    });
  }

  private async checkEngineExists(engineId: string) {
    const {
      result: { exists },
    } = await this.sdk.query({
      action: "exists",
      controller: "device-manager/engine",
      index: engineId,
    });

    if (!exists) {
      throw new BadRequestError(`Engine "${engineId}" does not exists.`);
    }
  }

  private checkAttachedToEngine(device: KDocument<DeviceContent>) {
    if (!device._source.engineId) {
      throw new BadRequestError(
        `Device "${device._id}" is not attached to an engine.`,
      );
    }
  }

  private async getEngine(engineId: string): Promise<JSONObject> {
    const engine = await this.sdk.document.get(
      this.config.adminIndex,
      InternalCollection.CONFIG,
      `engine-device-manager--${engineId}`,
    );

    return engine._source.engine;
  }

  private getDeviceModel(model: string): Promise<DeviceModelContent> {
    return ask<AskModelDeviceGet>("ask:device-manager:model:device:get", {
      model,
    });
  }

  private getAssetModel(
    engineGroup: string,
    model: string,
  ): Promise<AssetModelContent> {
    return ask<AskModelAssetGet>("ask:device-manager:model:asset:get", {
      engineGroup,
      model,
    });
  }

  private async refreshModel({
    deviceModel,
  }: {
    deviceModel: DeviceModelContent;
  }): Promise<void> {
    const engines = await ask<AskEngineList>("ask:device-manager:engine:list", {
      group: null,
    });

    const targets = engines.map((engine) => ({
      collections: [InternalCollection.DEVICES],
      index: engine.index,
    }));

    const devices = await this.sdk.query<
      BaseRequest,
      DocumentSearchResult<DeviceContent>
    >({
      action: "search",
      body: { query: { equals: { model: deviceModel.device.model } } },
      controller: "document",
      lang: "koncorde",
      targets,
    });

    const updatedDevicesPerIndex: Record<string, KDocument<DeviceContent>[]> =
      devices.result.hits.reduce(
        (
          acc: Record<string, KDocument<DeviceContent>[]>,
          device: JSONObject,
        ) => {
          device._source.measureSlots = deviceModel.device.measures;

          acc[device.index].push(device as KDocument<DeviceContent>);

          return acc;
        },
        Object.fromEntries(
          engines.map((engine) => [
            engine.index,
            [] as KDocument<DeviceContent>[],
          ]),
        ),
      );

    await Promise.all(
      Object.entries(updatedDevicesPerIndex).map(([index, updatedDevices]) =>
        this.sdk.document.mReplace<DeviceContent>(
          index,
          InternalCollection.DEVICES,
          updatedDevices.map((device) => ({
            _id: device._id,
            body: device._source,
          })),
          { refresh: "wait_for" },
        ),
      ),
    );
  }
}
