import {
  Backend,
  CollectionMappings,
  InternalError,
  KDocumentContent,
  KDocumentContentGeneric,
  Plugin,
} from "kuzzle";
import {
  AbstractEngine,
  ConfigManager,
  EngineContent,
  onAsk,
} from "kuzzle-plugin-commons";
import { JSONObject } from "kuzzle-sdk";
import _ from "lodash";

import { assetGroupsMappings, assetsHistoryMappings } from "../asset";
import { NamedMeasures } from "../decoder";
import { getEmbeddedMeasureMappings, measuresMappings } from "../measure";
import {
  AssetModelContent,
  DeviceModelContent,
  MeasureModelContent,
} from "../model";

import { DeviceManagerPlugin } from "./DeviceManagerPlugin";
import { DeviceManagerConfiguration } from "./types/DeviceManagerConfiguration";
import { InternalCollection } from "./types/InternalCollection";
import {
  ConflictChunk,
  getMeasureConflicts,
  getTwinConflicts,
} from "../model/ModelsConflicts";
import { addSchemaToCache } from "../shared/utils/AJValidator";

export type TwinType = "asset" | "device";

export type TwinModelContent = AssetModelContent | DeviceModelContent;

export interface EngineDocument extends KDocumentContent {
  type: "engine-device-manager";
  engine: {
    group: string;
    index: string;
    name: string;
  };
}

export type AskEngineList = {
  name: "ask:device-manager:engine:list";

  payload: {
    group: string | null;
  };

  result: EngineContent[];
};

export type AskEngineUpdateAll = {
  name: "ask:device-manager:engine:updateAll";

  payload: void;

  result: void;
};

export type AskEngineUpdateConflict = {
  name: "ask:device-manager:engine:doesUpdateConflict";

  payload: {
    twin?: {
      type: TwinType;
      models: TwinModelContent[];
    };
    measuresModels?: MeasureModelContent[];
  };

  result: ConflictChunk[];
};

export class DeviceManagerEngine extends AbstractEngine<DeviceManagerPlugin> {
  public config: DeviceManagerConfiguration;

  get app(): Backend {
    return global.app;
  }

  constructor(
    plugin: Plugin,
    adminConfigManager: ConfigManager,
    engineConfigManager: ConfigManager,
  ) {
    super(
      "device-manager",
      plugin,
      plugin.config.adminIndex,
      adminConfigManager,
      engineConfigManager,
    );

    this.context = plugin.context;

    onAsk<AskEngineList>("ask:device-manager:engine:list", async ({ group }) =>
      this.list(group),
    );

    onAsk<AskEngineUpdateAll>(
      "ask:device-manager:engine:updateAll",
      async () => {
        await this.updateEngines();
        await this.updateMeasuresSchema();
        await this.createDevicesCollection(this.config.adminIndex);
      },
    );

    onAsk<AskEngineUpdateConflict>(
      "ask:device-manager:engine:doesUpdateConflict",
      async (payload) => {
        if (!payload) {
          return [];
        }

        if (
          payload.twin === undefined &&
          payload.measuresModels === undefined
        ) {
          return [];
        }

        const measureModels = await this.getModels<MeasureModelContent>(
          this.config.adminIndex,
          "measure",
        );

        const results = await this.getEngines();
        const engineGroups = results.map((elt) => elt.engine.group);
        const groups = [undefined, ...engineGroups];

        for (const group of groups) {
          if (payload.twin) {
            const twinModels = await this.getModels<TwinModelContent>(
              this.config.adminIndex,
              payload.twin.type,
              group,
            );

            const conflicts = await this.doesTwinUpdateConflicts(
              payload.twin.type,
              twinModels,
              payload.twin.models,
              measureModels,
            );

            if (conflicts.length > 0) {
              return conflicts;
            }
          }
        }

        if (payload.measuresModels) {
          return this.doesMeasuresUpdateConflicts(
            measureModels,
            payload.measuresModels,
          );
        }

        return [];
      },
    );
  }

  /**
   * Return conflicts between the new and already present twin models
   *
   * @param twinType The target twin type
   * @param twinModels The already present twin models
   * @param additionalModels The new or updated twin models
   * @param measureModels The already present measures models
   *
   * @throws If a measure type declared in the twin does not exists
   * @returns An array of conflict chunk
   */
  private async doesTwinUpdateConflicts(
    twinType: TwinType,
    twinModels: TwinModelContent[],
    additionalModels: TwinModelContent[],
    measureModels: MeasureModelContent[],
  ): Promise<ConflictChunk[]> {
    const conflicts: ConflictChunk[] = [];

    for (const additional of additionalModels) {
      for (const { type: measureType } of additional[twinType]
        .measures as NamedMeasures) {
        const measureModel = measureModels.find(
          (m) => m.measure.type === measureType,
        );

        if (!measureModel) {
          throw new InternalError(
            `Cannot find measure "${measureType}" declared in ${[
              twinType,
            ]} "${additional[twinType].model}"`,
          );
        }
      }

      conflicts.push(...getTwinConflicts(twinType, twinModels, additional));
    }

    return conflicts;
  }

  /**
   * Return conflicts between the new and already present measure models
   *
   * @param measuresModels The already present measure models
   * @param additionalMeasures The new or updated measure models
   * @returns An array of ConflictChunk
   */
  private async doesMeasuresUpdateConflicts(
    measuresModels: MeasureModelContent[],
    additionalMeasures: MeasureModelContent[],
  ): Promise<ConflictChunk[]> {
    const conflicts: ConflictChunk[] = [];

    for (const model of additionalMeasures) {
      conflicts.push(...getMeasureConflicts(measuresModels, model));
    }

    return conflicts;
  }

  async updateEngines() {
    const results = await this.getEngines();

    this.context.log.info(`Update ${results.length} existing engines`);

    for (const document of results) {
      await this.onUpdate(document.engine.index, document.engine.group);
    }
  }

  /**
   * Search and return every engines in use
   *
   * @returns An array of the available engines
   */
  async getEngines(): Promise<EngineDocument[]> {
    const result = await this.sdk.document.search<EngineDocument>(
      this.config.adminIndex,
      InternalCollection.CONFIG,
      {
        query: {
          equals: { type: "engine-device-manager" },
        },
      },
      { lang: "koncorde", size: 5000 },
    );

    return result.hits.map((elt) => elt._source);
  }

  async updateMeasuresSchema() {
    const models = await this.getModels<MeasureModelContent>(
      this.adminIndex,
      "measure",
    );

    for (const measure of models) {
      const { validationSchema } = measure.measure;
      if (validationSchema) {
        try {
          addSchemaToCache(measure.measure.type, validationSchema);
        } catch (error) {
          this.app.log.error(
            `The validation schema for the "${measure.type}" measure model does not comply with the JSON Schema standard, so its update has been skipped`,
          );
        }
      }
    }
  }

  async onCreate(index: string, group = "commons") {
    const promises = [];

    promises.push(this.createAssetsCollection(index, group));

    promises.push(this.createAssetsHistoryCollection(index, group));

    promises.push(this.createAssetsGroupsCollection(index));

    promises.push(this.createDevicesCollection(index));

    promises.push(this.createMeasuresCollection(index, group));

    const collections = await Promise.all(promises);

    return {
      collections: [this.engineConfigManager.collection, ...collections],
    };
  }

  async onUpdate(index: string, group = "commons") {
    const promises = [];

    promises.push(this.createAssetsCollection(index, group));

    promises.push(this.createAssetsHistoryCollection(index, group));

    promises.push(this.createAssetsGroupsCollection(index));

    promises.push(this.createDevicesCollection(index));

    promises.push(this.createMeasuresCollection(index, group));

    const collections = await Promise.all(promises);

    return { collections };
  }

  async onDelete(index: string) {
    const collections = [
      InternalCollection.ASSETS,
      InternalCollection.ASSETS_HISTORY,
      InternalCollection.ASSETS_GROUPS,
      InternalCollection.DEVICES,
      InternalCollection.MEASURES,
    ];
    await Promise.all(
      collections.map(async (collection) => {
        if (await this.sdk.collection.exists(index, collection)) {
          await this.sdk.collection.delete(index, collection);
        }
      }),
    );
    await this.detachDevicesFromAdminIndex(index);
    return {
      collections,
    };
  }

  /**
   * Generate assets mappings and create the assets collection in the engine
   *
   * @param engineId The target engine Id
   * @param engineGroup The engine group
   *
   * @throws If it failed during the assets collection creation
   */
  async createAssetsCollection(engineId: string, engineGroup: string) {
    const mappings = await this.getDigitalTwinMappingsFromDB<AssetModelContent>(
      "asset",
      engineGroup,
    );
    const settings = this.config.engineCollections.asset.settings;

    await this.tryCreateCollection(engineId, InternalCollection.ASSETS, {
      mappings,
      settings,
    });

    return InternalCollection.ASSETS;
  }

  /**
   * Generate assets mappings and create the assets history collection in the engine
   *
   * @param engineId The target engine Id
   * @param engineGroup The engine group
   *
   * @throws If it failed during the assets history collection creation
   */
  async createAssetsHistoryCollection(engineId: string, engineGroup: string) {
    const assetsMappings =
      await this.getDigitalTwinMappingsFromDB<AssetModelContent>(
        "asset",
        engineGroup,
      );

    const mappings = JSON.parse(JSON.stringify(assetsHistoryMappings));

    _.merge(mappings.properties.asset, assetsMappings);

    const settings = this.config.engineCollections.assetHistory.settings;

    await this.tryCreateCollection(
      engineId,
      InternalCollection.ASSETS_HISTORY,
      {
        mappings,
        settings,
      },
    );

    return InternalCollection.ASSETS_HISTORY;
  }

  /**
   * Create the assets groups collection with the assets groups mappings in the engine
   *
   * @param engineId The target engine Id
   * @param engineGroup The engine group
   *
   * @throws If it failed during the assets groups collection creation
   */
  async createAssetsGroupsCollection(engineId: string) {
    const settings = this.config.engineCollections.assetGroups.settings;

    await this.tryCreateCollection(engineId, InternalCollection.ASSETS_GROUPS, {
      mappings: assetGroupsMappings,
      settings,
    });

    return InternalCollection.ASSETS_GROUPS;
  }

  /**
   * Generate devices mappings and create the devices collection in the engine
   *
   * @param engineId The target engine Id
   * @param engineGroup The engine group
   *
   * @throws If it failed during the devices collection creation
   */
  async createDevicesCollection(engineId: string) {
    const mappings =
      await this.getDigitalTwinMappingsFromDB<DeviceModelContent>("device");
    const settings = this.config.engineCollections.device.settings;

    await this.tryCreateCollection(engineId, InternalCollection.DEVICES, {
      mappings,
      settings,
    });

    return InternalCollection.DEVICES;
  }

  /**
   * Generate measures mappings and create the measures collection in the engine
   *
   * @param engineId The target engine Id
   * @param engineGroup The engine group
   *
   * @throws If it failed during the measures collection creation
   */
  async createMeasuresCollection(engineId: string, engineGroup: string) {
    const mappings = await this.getMeasuresMappingsFromDB(engineGroup);
    const settings = this.config.engineCollections.measures.settings;

    await this.tryCreateCollection(engineId, InternalCollection.MEASURES, {
      mappings,
      settings,
    });

    return InternalCollection.MEASURES;
  }

  /**
   * Create a collection with custom mappings in an engine
   *
   * @param engineIndex The target engine
   * @param collection The collection name
   * @param mappings The collection mappings
   *
   * @throws If it failed to create the collection
   */
  private async tryCreateCollection(
    engineIndex: string,
    collection: string,
    options:
      | CollectionMappings
      | {
          mappings?: CollectionMappings;
          settings?: JSONObject;
        },
  ) {
    try {
      await this.sdk.collection.create(engineIndex, collection, options);
    } catch (error) {
      throw new InternalError(
        `Failed to create the collection [${collection}] for engine [${engineIndex}]: ${error.message}`,
        error,
      );
    }
  }

  /**
   * Generate ES mappings from twin models and theirs associated measures, all fetched from the database
   *
   * @param digitalTwinType The target twin type
   * @param engineGroup The twin engine group
   * @returns The complete ES mappings produces by merging all the target type twins
   */
  private async getDigitalTwinMappingsFromDB<
    TDigitalTwin extends TwinModelContent,
  >(digitalTwinType: TwinType, engineGroup?: string) {
    const models = await this.getModels<TDigitalTwin>(
      this.config.adminIndex,
      digitalTwinType,
      engineGroup,
    );

    const measureModels = await this.getModels<MeasureModelContent>(
      this.config.adminIndex,
      "measure",
    );

    return this.getDigitalTwinMappings<TDigitalTwin>(
      digitalTwinType,
      models,
      measureModels,
    );
  }

  /**
   * Generate ES mappings from twin models and theirs associated measures
   *
   * @param digitalTwinType The target twin type
   * @param models The twin models
   * @param measureModels The associated measures
   * @returns The complete ES mappings produces by merging all the target type twins
   */
  private async getDigitalTwinMappings<TDigitalTwin extends TwinModelContent>(
    digitalTwinType: TwinType,
    models: TDigitalTwin[],
    measureModels: MeasureModelContent[],
  ) {
    if (
      this.config.engineCollections[digitalTwinType] === undefined ||
      this.config.engineCollections[digitalTwinType].mappings === undefined
    ) {
      throw new InternalError(`Cannot find mapping for "${digitalTwinType}"`);
    }

    const mappings = JSON.parse(
      JSON.stringify(this.config.engineCollections[digitalTwinType].mappings),
    );

    for (const model of models) {
      _.merge(
        mappings.properties.metadata.properties,
        model[digitalTwinType].metadataMappings,
      );

      for (const { name: measureName, type: measureType } of model[
        digitalTwinType
      ].measures as NamedMeasures) {
        const measureModel = measureModels.find(
          (m) => m.measure.type === measureType,
        );

        if (!measureModel) {
          throw new InternalError(
            `Cannot find measure "${measureType}" declared in ${[
              digitalTwinType,
            ]} "${model[digitalTwinType].model}"`,
          );
        }

        mappings.properties.measures.properties[measureName] =
          getEmbeddedMeasureMappings(measureModel.measure.valuesMappings);
      }
    }

    return mappings;
  }

  /**
   * Generate ES mappings from measures and theirs associated assets, all fetched via the database
   *
   * @param engineGroup The target engine group
   * @returns The complete ES mappings produced by merging models mappings
   */
  private async getMeasuresMappingsFromDB(engineGroup: string) {
    const models = await this.getModels<MeasureModelContent>(
      this.config.adminIndex,
      "measure",
    );

    const assetsMappings = await this.getDigitalTwinMappingsFromDB(
      "asset",
      engineGroup,
    );

    const deviceMappings = await this.getDigitalTwinMappingsFromDB("device");

    return this.getMeasuresMappings(models, assetsMappings, deviceMappings);
  }

  /**
   * Generate ES mappings from measures and theirs associated assets
   *
   * @param models The measures models
   * @param assetsMappings The assets complete mappings
   * @returns The complete ES mappings produced by merging models mappings
   */
  private async getMeasuresMappings(
    models: MeasureModelContent[],
    assetsMappings: any,
    deviceMappings: any,
  ) {
    const mappings = JSON.parse(JSON.stringify(measuresMappings));

    for (const model of models) {
      _.merge(
        mappings.properties.values.properties,
        model.measure.valuesMappings,
      );
    }

    mappings.properties.asset.properties.metadata.properties =
      assetsMappings.properties.metadata.properties;

    mappings.properties.origin.properties.deviceMetadata.properties =
      deviceMappings.properties.metadata.properties;

    return mappings;
  }

  /**
   * Retrieve a certain type of models associated to an engine
   *
   * @param engineId The target engine Id
   * @param type The desired model type
   * @param engineGroup The target engine group
   * @returns An array of the generic type provided
   */
  private async getModels<T extends KDocumentContentGeneric>(
    engineId: string,
    type: string,
    engineGroup?: string,
  ): Promise<T[]> {
    const query: JSONObject = {
      and: [{ equals: { type } }],
    };

    if (engineGroup) {
      query.and.push({
        or: [
          { equals: { engineGroup } },
          { equals: { engineGroup: "commons" } },
        ],
      });
    }

    const result = await this.sdk.document.search<T>(
      engineId,
      InternalCollection.MODELS,
      { query },
      { lang: "koncorde", size: 5000 },
    );

    return result.hits.map((elt) => elt._source);
  }

  /**
   * Detach all devices of an index in the admin index
   *
   * @param engineId The target engine Id
   * @returns {any}
   */
  private async detachDevicesFromAdminIndex(engineId: string) {
    const devices = [];

    let result = await this.sdk.document.search(
      this.adminIndex,
      "devices",
      {
        _source: false,
        query: { bool: { must: { term: { engineId } } } },
      },
      {
        scroll: "2s",
        size: 100,
      },
    );
    while (result !== null) {
      devices.push(...result.hits);
      result = await result.next();
    }
    if (devices.length > 0) {
      void this.sdk.document.mUpdate(
        this.adminIndex,
        "devices",
        devices.map((device) => {
          return { _id: device._id, body: { assetId: null, engineId: null } };
        }),
      );
    }
  }
}
