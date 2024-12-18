import { BadRequestError, KuzzleRequest, User } from "kuzzle";
import { ask, onAsk } from "kuzzle-plugin-commons";
import {
  BaseRequest,
  DocumentSearchResult,
  JSONObject,
  KDocument,
  KHit,
  SearchResult,
  mReplaceResponse,
} from "kuzzle-sdk";
import _ from "lodash";

import {
  AskDeviceAttachEngine,
  AskDeviceDetachEngine,
  AskDeviceLinkAsset,
  AskDeviceUnlinkAsset,
} from "../device";
import { AskModelAssetGet, AssetModelContent } from "../model";
import {
  AskEngineList,
  DeviceManagerPlugin,
  InternalCollection,
} from "../plugin";
import {
  DigitalTwinService,
  EmbeddedMeasure,
  Metadata,
  SearchParams,
  flattenObject,
  lock,
} from "../shared";

import { AssetHistoryService } from "./AssetHistoryService";
import { AssetSerializer } from "./model/AssetSerializer";
import { ApiAssetMigrateTenantResult } from "./types/AssetApi";
import { AssetContent } from "./types/AssetContent";
import {
  AskAssetRefreshModel,
  EventAssetUpdateAfter,
  EventAssetUpdateBefore,
} from "./types/AssetEvents";
import {
  AssetHistoryContent,
  AssetHistoryEventMetadata,
} from "./types/AssetHistoryContent";

export class AssetService extends DigitalTwinService {
  private assetHistoryService: AssetHistoryService;

  constructor(
    plugin: DeviceManagerPlugin,
    assetHistoryService: AssetHistoryService,
  ) {
    super(plugin, InternalCollection.ASSETS);

    this.assetHistoryService = assetHistoryService;
  }

  override registerAskEvents() {
    super.registerAskEvents();

    onAsk<AskAssetRefreshModel>(
      "ask:device-manager:asset:refresh-model",
      this.refreshModel.bind(this),
    );
  }

  public async get(
    engineId: string,
    assetId: string,
    request: KuzzleRequest,
  ): Promise<KDocument<AssetContent>> {
    return this.getDocument<AssetContent>(request, assetId, {
      collection: InternalCollection.ASSETS,
      engineId,
    });
  }

  /**
   * Update an asset metadata
   */
  public async update(
    engineId: string,
    assetId: string,
    metadata: Metadata,
    request: KuzzleRequest,
  ): Promise<KDocument<AssetContent>> {
    return lock(`asset:${engineId}:${assetId}`, async () => {
      const asset = await this.get(engineId, assetId, request);

      const updatedPayload = await this.app.trigger<EventAssetUpdateBefore>(
        "device-manager:asset:update:before",
        { asset, metadata },
      );

      const updatedAsset = await this.updateDocument<AssetContent>(
        request,
        {
          _id: assetId,
          _source: { metadata: updatedPayload.metadata },
        },
        {
          collection: InternalCollection.ASSETS,
          engineId,
        },
        { source: true },
      );

      await this.assetHistoryService.add<AssetHistoryEventMetadata>(engineId, [
        {
          asset: updatedAsset._source,
          event: {
            metadata: {
              names: Object.keys(flattenObject(updatedPayload.metadata)),
            },
            name: "metadata",
          },
          id: updatedAsset._id,
          timestamp: Date.now(),
        },
      ]);

      await this.app.trigger<EventAssetUpdateAfter>(
        "device-manager:asset:update:after",
        {
          asset: updatedAsset,
          metadata: updatedPayload.metadata,
        },
      );

      return updatedAsset;
    });
  }

  /**
   * Replace an asset metadata
   */
  public async replaceMetadata(
    engineId: string,
    assetId: string,
    metadata: Metadata,
    request: KuzzleRequest,
  ): Promise<KDocument<AssetContent>> {
    const asset = await this.get(engineId, assetId, request);
    const unknownMetadata = {};
    for (const key in metadata) {
      if (key in asset._source.metadata) {
        asset._source.metadata[key] = metadata[key];
      } else {
        unknownMetadata[key] = metadata[key];
      }
    }
    // ? If metadata key is unknown on the asset we check that it exists in the assetModel mappings
    if (Object.keys(unknownMetadata).length > 0) {
      const assetModel = await ask<AskModelAssetGet>(
        "ask:device-manager:model:asset:get",
        { engineGroup: engineId.split("-")[1], model: asset._source.model },
      );
      for (const key in unknownMetadata) {
        if (key in assetModel.asset.metadataMappings) {
          asset._source.metadata[key] = unknownMetadata[key];
        }
      }
    }
    const updatedPayload = await this.app.trigger<EventAssetUpdateBefore>(
      "device-manager:asset:update:before",
      { asset, metadata },
    );

    const updatedAsset = await this.sdk.document.replace<AssetContent>(
      engineId,
      InternalCollection.ASSETS,
      assetId,
      updatedPayload.asset._source,
      { triggerEvents: true },
    );

    await this.assetHistoryService.add<AssetHistoryEventMetadata>(engineId, [
      {
        asset: updatedAsset._source,
        event: {
          metadata: {
            names: Object.keys(flattenObject(updatedPayload.metadata)),
          },
          name: "metadata",
        },
        id: updatedAsset._id,
        timestamp: Date.now(),
      },
    ]);

    await this.app.trigger<EventAssetUpdateAfter>(
      "device-manager:asset:update:after",
      {
        asset: updatedAsset,
        metadata: updatedPayload.metadata,
      },
    );

    return updatedAsset;
  }

  /**
   * Update or Create an asset metadata
   */
  public async upsert(
    engineId: string,
    model: string,
    reference: string,
    metadata: Metadata,
    request: KuzzleRequest,
  ): Promise<KDocument<AssetContent>> {
    const assetId = `${model}-${reference}`;
    return lock(`asset:${engineId}:${assetId}`, async () => {
      const asset = await this.get(engineId, assetId, request).catch(
        () => null,
      );

      if (!asset) {
        return this.create(engineId, model, reference, metadata, request);
      }

      const updatedPayload = await this.app.trigger<EventAssetUpdateBefore>(
        "device-manager:asset:update:before",
        { asset, metadata },
      );

      const updatedAsset = await this.updateDocument<AssetContent>(
        request,
        {
          _id: assetId,
          _source: { metadata: updatedPayload.metadata },
        },
        {
          collection: InternalCollection.ASSETS,
          engineId,
        },
        { source: true },
      );

      await this.assetHistoryService.add<AssetHistoryEventMetadata>(engineId, [
        {
          asset: updatedAsset._source,
          event: {
            metadata: {
              names: Object.keys(flattenObject(updatedPayload.metadata)),
            },
            name: "metadata",
          },
          id: updatedAsset._id,
          timestamp: Date.now(),
        },
      ]);

      await this.app.trigger<EventAssetUpdateAfter>(
        "device-manager:asset:update:after",
        {
          asset: updatedAsset,
          metadata: updatedPayload.metadata,
        },
      );

      return updatedAsset;
    });
  }

  /**
   * Create an asset metadata
   */
  public async create(
    engineId: string,
    model: string,
    reference: string,
    metadata: JSONObject,
    request: KuzzleRequest,
  ): Promise<KDocument<AssetContent>> {
    const assetId = AssetSerializer.id(model, reference);

    return lock(`asset:${engineId}:${assetId}`, async () => {
      const engine = await this.getEngine(engineId);
      const assetModel = await ask<AskModelAssetGet>(
        "ask:device-manager:model:asset:get",
        { engineGroup: engine.group, model },
      );

      const assetMetadata = {};
      for (const metadataName of Object.keys(
        assetModel.asset.metadataMappings,
      )) {
        assetMetadata[metadataName] = null;
      }
      for (const [metadataName, metadataValue] of Object.entries(
        assetModel.asset.defaultMetadata,
      )) {
        _.set(assetMetadata, metadataName, metadataValue);
      }

      const measures: Record<string, EmbeddedMeasure> = {};

      for (const { name } of assetModel.asset.measures) {
        measures[name] = null;
      }

      const asset = await this.createDocument<AssetContent>(
        request,
        {
          _id: assetId,
          _source: {
            groups: [],
            lastMeasuredAt: null,
            linkedDevices: [],
            measures,
            metadata: { ...assetMetadata, ...metadata },
            model,
            reference,
            softTenant: [],
          },
        },
        {
          collection: InternalCollection.ASSETS,
          engineId,
        },
      );

      await this.assetHistoryService.add<AssetHistoryEventMetadata>(engineId, [
        {
          asset: asset._source,
          event: {
            metadata: {
              names: Object.keys(flattenObject(asset._source.metadata)),
            },
            name: "metadata",
          },
          id: asset._id,
          timestamp: Date.now(),
        },
      ]);

      return asset;
    });
  }

  /**
   * Delete an asset metadata
   */
  public async delete(
    engineId: string,
    assetId: string,
    request: KuzzleRequest,
  ) {
    const user = request.getUser();
    const strict = request.getBoolean("strict");

    return lock<void>(`asset:${engineId}:${assetId}`, async () => {
      const asset = await this.get(engineId, assetId, request);

      if (strict && asset._source.linkedDevices.length !== 0) {
        throw new BadRequestError(
          `Asset "${assetId}" is still linked to devices.`,
        );
      }

      for (const { _id: deviceId } of asset._source.linkedDevices) {
        await ask<AskDeviceUnlinkAsset>(
          "ask:device-manager:device:unlink-asset",
          { deviceId, user },
        );
      }

      await this.deleteDocument(request, assetId, {
        collection: InternalCollection.ASSETS,
        engineId,
      });
    });
  }

  public async search(
    engineId: string,
    searchParams: SearchParams,
    request: KuzzleRequest,
  ): Promise<SearchResult<KHit<AssetContent>>> {
    return this.searchDocument<AssetContent>(request, searchParams, {
      collection: InternalCollection.ASSETS,
      engineId,
    });
  }

  public async migrateTenant(
    user: User,
    assetsList: string[],
    engineId: string,
    newEngineId: string,
  ): Promise<ApiAssetMigrateTenantResult> {
    let errors = [];
    let successes = [];

    //Sanity check
    if (assetsList.length === 0) {
      throw new BadRequestError("No assets to migrate");
    }

    await lock(`engine:${engineId}:${newEngineId}`, async () => {
      if (!user.profileIds.includes("admin")) {
        throw new BadRequestError(
          `User ${user._id} is not authorized to migrate assets`,
        );
      }

      // check if tenant destination is in the same group
      const engine = await this.getEngine(engineId);
      const newEngine = await this.getEngine(newEngineId);

      if (engine.group !== newEngine.group) {
        throw new BadRequestError(
          `Engine ${newEngineId} is not in the same group as ${engineId}`,
        );
      }

      //First of all, as mCreate seems to be buggy, ensure some assets don't
      //already exists in the destination tenant
      const assetsCheck = await this.sdk.document.mGet<AssetContent>(
        newEngineId,
        InternalCollection.ASSETS,
        assetsList,
      );
      const assetsCheckedIdExisting = assetsCheck.successes.map((a) => a._id);
      errors = [...assetsCheckedIdExisting];

      //Get all assets to migrate
      const assetsCheckedList = assetsList.filter(
        (id) => !assetsCheckedIdExisting.includes(id),
      );

      if (assetsCheckedList.length === 0) {
        throw new BadRequestError(
          "All assets to migrate already exists in destination tenant.",
        );
      }

      const assets = await this.sdk.document.mGet<AssetContent>(
        engineId,
        InternalCollection.ASSETS,
        assetsCheckedList,
      );
      errors = errors.concat(...assets.errors);

      if (assets.successes.length === 0) {
        this.app.log.error("No assets found to migrate");
        return { errors, successes };
      }

      //Get all the asset content, in order to create thm by batch
      const assetsContent = assets.successes.map((asset) => ({
        _id: asset._id,
        body: asset._source,
      }));

      //We want to create the new asset with linked devices and groups empty
      const assetsContentCopy = _.cloneDeep(assetsContent);
      for (const asset of assetsContentCopy) {
        asset.body.linkedDevices = [];
        asset.body.groups = [];
      }

      //Even if they exist in the destination tenant, try creating them all
      //using batch
      const assetsCreated = await this.sdk.document.mCreate(
        newEngineId,
        InternalCollection.ASSETS,
        assetsContentCopy,
      );

      //We consider here we will return as success what we have been able
      //to create, and related errors
      const assetsCreatedId = assetsCreated.successes.map((a) => a._id);
      const assetsNotCreatedId = assetsCreated.errors.map(
        (a) => a.document._id,
      );
      successes = [...assetsCreatedId];
      errors = errors.concat(...assetsNotCreatedId);

      //Iterate over all created asset, and migrate each one
      for (const asset of assetsCreated.successes) {
        //We need to recover the linked devices to this asset,
        //because we reset them when we create the asset
        const assetOriginal = assets.successes.find((a) => a._id === asset._id);

        // get linked devices to this asset, if any
        const linkedDevices = assetOriginal._source.linkedDevices.map((d) => ({
          _id: d._id,
          measureNames: d.measureNames,
        }));

        // ... and iterate over this list
        for (const device of linkedDevices) {
          // detach linked devices from current tenant (it also unkinks asset)
          await ask<AskDeviceDetachEngine>(
            "ask:device-manager:device:detach-engine",
            { deviceId: device._id, user },
          );

          // ... and attach to new tenant
          await ask<AskDeviceAttachEngine>(
            "ask:device-manager:device:attach-engine",
            { deviceId: device._id, engineId: newEngineId, user },
          );

          // ... and link this device to the asset in the new tenant
          await ask<AskDeviceLinkAsset>(
            "ask:device-manager:device:link-asset",
            {
              assetId: asset._id,
              deviceId: device._id,
              engineId: newEngineId,
              measureNames: device.measureNames,
              user,
            },
          );
        }
      }

      // Finally here, we can delete the newly create assets in the source engine !
      await this.sdk.document.mDelete(
        engineId,
        InternalCollection.ASSETS,
        assetsCreatedId,
      );

      //Refresh ES indexes and collections
      const collectionsToRefresh = [
        {
          collection: InternalCollection.ASSETS,
          index: engineId,
        },
        {
          collection: InternalCollection.DEVICES,
          index: engineId,
        },
        {
          collection: InternalCollection.ASSETS,
          index: newEngineId,
        },
        {
          collection: InternalCollection.DEVICES,
          index: newEngineId,
        },
        {
          collection: InternalCollection.DEVICES,
          index: this.config.adminIndex,
        },
      ].map(({ index, collection }) => {
        return this.sdk.collection.refresh(index, collection);
      });

      await Promise.all(collectionsToRefresh);
    });

    return { errors, successes };
  }

  /**
   * Replace an asset metadata
   */
  public async mReplaceAndHistorize(
    engineId: string,
    assets: KDocument<AssetContent>[],
    removedMetadata: string[],
    { refresh }: { refresh: any },
  ): Promise<mReplaceResponse> {
    const replacedAssets = await this.sdk.document.mReplace<AssetContent>(
      engineId,
      InternalCollection.ASSETS,
      assets.map((asset) => ({ _id: asset._id, body: asset._source })),
      { refresh, source: true },
    );

    const histories: AssetHistoryContent[] = replacedAssets.successes.map(
      (asset) => ({
        asset: asset._source as AssetContent,
        event: {
          metadata: {
            names: Object.keys(flattenObject(asset._source.metadata)),
          },
          name: "metadata",
        },
        id: asset._id,
        timestamp: Date.now(),
      }),
    );

    await this.assetHistoryService.add<AssetHistoryEventMetadata>(
      engineId,
      histories,
    );

    return replacedAssets;
  }

  private async getEngine(engineId: string): Promise<JSONObject> {
    const engine = await this.sdk.document.get(
      this.config.adminIndex,
      InternalCollection.CONFIG,
      `engine-device-manager--${engineId}`,
    );

    return engine._source.engine;
  }

  private async refreshModel({
    assetModel,
  }: {
    assetModel: AssetModelContent;
  }): Promise<void> {
    const engines = await ask<AskEngineList>("ask:device-manager:engine:list", {
      group: assetModel.engineGroup,
    });

    const targets = engines.map((engine) => ({
      collections: [InternalCollection.ASSETS],
      index: engine.index,
    }));

    const assets = await this.sdk.query<
      BaseRequest,
      DocumentSearchResult<AssetContent>
    >({
      action: "search",
      body: { query: { equals: { model: assetModel.asset.model } } },
      controller: "document",
      lang: "koncorde",
      targets,
    });

    const modelMetadata = {};

    for (const metadataName of Object.keys(assetModel.asset.metadataMappings)) {
      const defaultMetadata = assetModel.asset.defaultMetadata[metadataName];
      modelMetadata[metadataName] = defaultMetadata ?? null;
    }

    const removedMetadata: string[] = [];

    const updatedAssetsPerIndex: Record<string, KDocument<AssetContent>[]> =
      assets.result.hits.reduce(
        (acc: Record<string, KDocument<AssetContent>[]>, asset: JSONObject) => {
          const assetMetadata = { ...asset._source.metadata };

          for (const key of Object.keys(asset._source.metadata)) {
            if (!(key in modelMetadata)) {
              removedMetadata.push(key);
              delete assetMetadata[key];
            }
          }

          asset._source.metadata = {
            ...modelMetadata,
            ...assetMetadata,
          };

          acc[asset.index].push(asset as KDocument<AssetContent>);

          return acc;
        },
        Object.fromEntries(
          engines.map((engine) => [
            engine.index,
            [] as KDocument<AssetContent>[],
          ]),
        ),
      );

    await Promise.all(
      Object.entries(updatedAssetsPerIndex).map(([index, updatedAssets]) =>
        this.mReplaceAndHistorize(index, updatedAssets, removedMetadata, {
          refresh: "wait_for",
        }),
      ),
    );
  }
}
