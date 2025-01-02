import {
  BadRequestError,
  EventGenericDocumentAfterUpdate,
  EventGenericDocumentBeforeUpdate,
  EventGenericDocumentBeforeWrite,
  Inflector,
  KDocumentContent,
  KuzzleRequest,
  NotFoundError,
} from "kuzzle";
import { ask, onAsk } from "kuzzle-plugin-commons";
import { JSONObject, KDocument, KHit, SearchResult } from "kuzzle-sdk";

import {
  AskEngineUpdateAll,
  AskEngineUpdateConflict,
  DeviceManagerPlugin,
  InternalCollection,
} from "../plugin";

import { AskAssetRefreshModel } from "../asset";
import { BaseService, SearchParams, flattenObject } from "../shared";
import { ModelSerializer } from "./ModelSerializer";
import {
  AssetModelContent,
  DeviceModelContent,
  LocaleDetails,
  MeasureModelContent,
  MetadataDetails,
  MetadataGroups,
  MetadataMappings,
  ModelContent,
  TooltipModels,
} from "./types/ModelContent";
import {
  AskModelAssetGet,
  AskModelDeviceGet,
  AskModelMeasureGet,
} from "./types/ModelEvents";
import { MappingsConflictsError } from "./MappingsConflictsError";
import { SchemaObject } from "ajv";
import { addSchemaToCache, getAJVErrors } from "../shared/utils/AJValidator";
import { SchemaValidationError } from "../shared/errors/SchemaValidationError";
import { MeasureValuesDetails } from "../measure";
import { NamedMeasures } from "../decoder";
import { getNamedMeasuresDuplicates } from "./MeasuresDuplicates";
import { MeasuresNamesDuplicatesError } from "./MeasuresNamesDuplicatesError";

export class ModelService extends BaseService {
  constructor(plugin: DeviceManagerPlugin) {
    super(plugin);

    this.registerAskEvents();
  }

  registerAskEvents() {
    onAsk<AskModelAssetGet>(
      "ask:device-manager:model:asset:get",
      async ({ engineGroup, model }) => {
        const assetModel = await this.getAsset(engineGroup, model);

        return assetModel._source;
      },
    );
    onAsk<AskModelDeviceGet>(
      "ask:device-manager:model:device:get",
      async ({ model }) => {
        const deviceModel = await this.getDevice(model);

        return deviceModel._source;
      },
    );
    onAsk<AskModelMeasureGet>(
      "ask:device-manager:model:measure:get",
      async ({ type }) => {
        const measureModel = await this.getMeasure(type);

        return measureModel._source;
      },
    );

    const genericModelsHandler = async (
      documents: KDocument<KDocumentContent>[],
      request: KuzzleRequest,
    ) => {
      const { index, collection } = request.input.args;

      if (index === this.config.adminIndex && collection === "models") {
        const models = documents.map((elt) => {
          return elt._source;
        }) as ModelContent[];

        await this.checkModelsConflicts(models);
      }

      return documents;
    };

    this.app.pipe.register<EventGenericDocumentBeforeWrite>(
      "generic:document:beforeWrite",
      genericModelsHandler,
    );
    this.app.pipe.register<EventGenericDocumentBeforeUpdate>(
      "generic:document:beforeUpdate",
      genericModelsHandler,
    );

    this.app.hook.register<EventGenericDocumentAfterUpdate>(
      "generic:document:afterUpdate",
      async (documents, request) => {
        const { index, collection } = request.input.args;

        if (index === this.config.adminIndex && collection === "models") {
          await ask<AskEngineUpdateAll>("ask:device-manager:engine:updateAll");
        }
      },
    );
  }

  private async checkModelsConflicts(documents: ModelContent[]) {
    const assets = documents.filter((elt) => {
      return elt.type === "asset";
    }) as AssetModelContent[];

    const devices = documents.filter((elt) => {
      return elt.type === "device";
    }) as DeviceModelContent[];

    const measures = documents.filter((elt) => {
      return elt.type === "measure";
    }) as MeasureModelContent[];

    if (assets.length > 0) {
      const conflicts = await ask<AskEngineUpdateConflict>(
        "ask:device-manager:engine:doesUpdateConflict",
        {
          twin: {
            models: assets,
            type: "asset",
          },
        },
      );

      if (conflicts.length > 0) {
        throw new MappingsConflictsError(
          `New assets mappings are causing conflicts`,
          conflicts,
        );
      }
    }

    if (devices.length > 0) {
      const conflicts = await ask<AskEngineUpdateConflict>(
        "ask:device-manager:engine:doesUpdateConflict",
        {
          twin: {
            models: devices,
            type: "device",
          },
        },
      );

      if (conflicts.length > 0) {
        throw new MappingsConflictsError(
          `New devices mappings are causing conflicts`,
          conflicts,
        );
      }
    }

    if (measures.length > 0) {
      const conflicts = await ask<AskEngineUpdateConflict>(
        "ask:device-manager:engine:doesUpdateConflict",
        {
          measuresModels: measures,
        },
      );

      if (conflicts.length > 0) {
        throw new MappingsConflictsError(
          `New measures mappings are causing conflicts`,
          conflicts,
        );
      }
    }
  }

  async writeAsset(
    engineGroup: string,
    model: string,
    metadataMappings: MetadataMappings,
    defaultMetadata: JSONObject,
    metadataDetails: MetadataDetails,
    metadataGroups: MetadataGroups,
    measures: NamedMeasures,
    tooltipModels: TooltipModels,
    locales: { [valueName: string]: LocaleDetails },
  ): Promise<KDocument<AssetModelContent>> {
    if (Inflector.pascalCase(model) !== model) {
      throw new BadRequestError(`Asset model "${model}" must be PascalCase.`);
    }
    const duplicates = getNamedMeasuresDuplicates(measures);

    if (duplicates.length > 0) {
      throw new MeasuresNamesDuplicatesError(
        "Asset model measures contain one or multiple duplicate measure name",
        duplicates,
      );
    }

    const modelContent: AssetModelContent = {
      asset: {
        defaultMetadata,
        locales,
        measures,
        metadataDetails,
        metadataGroups,
        metadataMappings,
        model,
        tooltipModels,
      },
      engineGroup,
      type: "asset",
    };

    this.checkDefaultValues(metadataMappings, defaultMetadata);

    const conflicts = await ask<AskEngineUpdateConflict>(
      "ask:device-manager:engine:doesUpdateConflict",
      { twin: { models: [modelContent], type: "asset" } },
    );

    if (conflicts.length > 0) {
      throw new MappingsConflictsError(
        `New assets mappings are causing conflicts`,
        conflicts,
      );
    }

    const assetModel =
      await this.sdk.document.createOrReplace<AssetModelContent>(
        this.config.adminIndex,
        InternalCollection.MODELS,
        ModelSerializer.id<AssetModelContent>("asset", modelContent),
        modelContent,
      );

    await this.sdk.collection.refresh(
      this.config.adminIndex,
      InternalCollection.MODELS,
    );
    await ask<AskEngineUpdateAll>("ask:device-manager:engine:updateAll");

    await ask<AskAssetRefreshModel>("ask:device-manager:asset:refresh-model", {
      assetModel: modelContent,
    });

    return assetModel;
  }

  private checkDefaultValues(
    metadataMappings: MetadataMappings,
    defaultMetadata: JSONObject,
  ) {
    const flattenedMetadataMappings = flattenObject(metadataMappings);

    const metadata = Object.keys(
      JSON.parse(
        JSON.stringify(flattenedMetadataMappings)
          .replace(/properties\./g, "")
          .replace(/\.type/g, ""),
      ),
    );

    const values = Object.keys(flattenObject(defaultMetadata));

    for (let i = 0; i < values.length; i++) {
      const key = values[i];

      // ? Check if the exact key exists in the metadata
      if (!metadata.includes(key)) {
        // ? Extract base key for complex types like geo_point or geo_shape
        const baseKey = key.includes(".") ? key.split(".")[0] : key;

        // ? Check if the base key is in the metadata
        if (!metadata.includes(baseKey)) {
          throw new BadRequestError(
            `The default value "${key}" is not in the metadata mappings.`,
          );
        }

        // ? Accept nested properties for geo_point or geo_shape
        const baseKeyMetadata = flattenedMetadataMappings[`${baseKey}.type`];
        if (
          baseKeyMetadata === "geo_point" ||
          baseKeyMetadata === "geo_shape"
        ) {
          continue;
        }

        throw new BadRequestError(
          `The default value "${values[i]}" is not in the metadata mappings.`,
        );
      }
    }
  }

  async writeDevice(
    model: string,
    metadataMappings: MetadataMappings,
    defaultMetadata: JSONObject,
    metadataDetails: MetadataDetails,
    metadataGroups: MetadataGroups,
    measures: NamedMeasures,
  ): Promise<KDocument<DeviceModelContent>> {
    if (Inflector.pascalCase(model) !== model) {
      throw new BadRequestError(`Device model "${model}" must be PascalCase.`);
    }

    const duplicates = getNamedMeasuresDuplicates(measures);

    if (duplicates.length > 0) {
      throw new MeasuresNamesDuplicatesError(
        "Device model measures contain one or multiple duplicate measure name",
        duplicates,
      );
    }

    const modelContent: DeviceModelContent = {
      device: {
        defaultMetadata,
        measures,
        metadataDetails,
        metadataGroups,
        metadataMappings,
        model,
      },
      type: "device",
    };

    const conflicts = await ask<AskEngineUpdateConflict>(
      "ask:device-manager:engine:doesUpdateConflict",
      { twin: { models: [modelContent], type: "device" } },
    );

    if (conflicts.length > 0) {
      throw new MappingsConflictsError(
        `New assets mappings are causing conflicts`,
        conflicts,
      );
    }

    const deviceModel =
      await this.sdk.document.createOrReplace<DeviceModelContent>(
        this.config.adminIndex,
        InternalCollection.MODELS,
        ModelSerializer.id<DeviceModelContent>("device", modelContent),
        modelContent,
      );

    await this.sdk.collection.refresh(
      this.config.adminIndex,
      InternalCollection.MODELS,
    );
    await ask<AskEngineUpdateAll>("ask:device-manager:engine:updateAll");

    return deviceModel;
  }

  async writeMeasure(
    type: string,
    valuesMappings: JSONObject,
    validationSchema?: SchemaObject,
    valuesDetails?: MeasureValuesDetails,
    locales?: {
      [valueName: string]: LocaleDetails;
    },
  ): Promise<KDocument<MeasureModelContent>> {
    const modelContent: MeasureModelContent = {
      measure: {
        locales,
        type,
        valuesDetails,
        valuesMappings,
      },
      type: "measure",
    };

    if (validationSchema) {
      try {
        addSchemaToCache(type, validationSchema);
        modelContent.measure.validationSchema = validationSchema;
      } catch (error) {
        throw new SchemaValidationError(
          "Provided schema is not valid",
          getAJVErrors(),
        );
      }
    }

    const conflicts = await ask<AskEngineUpdateConflict>(
      "ask:device-manager:engine:doesUpdateConflict",
      { measuresModels: [modelContent] },
    );

    if (conflicts.length > 0) {
      throw new MappingsConflictsError(
        `New assets mappings are causing conflicts`,
        conflicts,
      );
    }

    const measureModel =
      await this.sdk.document.createOrReplace<MeasureModelContent>(
        this.config.adminIndex,
        InternalCollection.MODELS,
        ModelSerializer.id<MeasureModelContent>("measure", modelContent),
        modelContent,
      );

    await this.sdk.collection.refresh(
      this.config.adminIndex,
      InternalCollection.MODELS,
    );
    await ask<AskEngineUpdateAll>("ask:device-manager:engine:updateAll");

    return measureModel;
  }

  async deleteAsset(_id: string) {
    await this.sdk.document.delete(
      this.config.adminIndex,
      InternalCollection.MODELS,
      _id,
    );
  }

  async deleteDevice(_id: string) {
    await this.sdk.document.delete(
      this.config.adminIndex,
      InternalCollection.MODELS,
      _id,
    );
  }

  async deleteMeasure(_id: string) {
    await this.sdk.document.delete(
      this.config.adminIndex,
      InternalCollection.MODELS,
      _id,
    );
  }

  async listAsset(
    engineGroup: string,
  ): Promise<KDocument<AssetModelContent>[]> {
    const result = await this.searchAssets(engineGroup, {
      searchBody: {
        sort: { "asset.model": "asc" },
      },
      size: 5000,
    });

    return result.hits;
  }

  async listDevices(): Promise<KDocument<DeviceModelContent>[]> {
    const result = await this.searchDevices({
      searchBody: {
        sort: { "device.model": "asc" },
      },
      size: 5000,
    });

    return result.hits;
  }

  async listMeasures(): Promise<KDocument<MeasureModelContent>[]> {
    const result = await this.searchMeasures({
      searchBody: {
        sort: { "measure.type": "asc" },
      },
      size: 5000,
    });

    return result.hits;
  }

  async searchAssets(
    engineGroup: string,
    searchParams: Partial<SearchParams>,
  ): Promise<SearchResult<KHit<AssetModelContent>>> {
    const query = {
      bool: {
        must: [
          searchParams.searchBody.query,
          { match: { type: "asset" } },
          {
            bool: {
              should: [
                { match: { engineGroup } },
                { match: { engineGroup: "commons" } },
              ],
            },
          },
        ],
      },
    };

    return this.sdk.document.search<AssetModelContent>(
      this.config.adminIndex,
      InternalCollection.MODELS,
      {
        ...searchParams.searchBody,
        query,
      },
      {
        from: searchParams.from,
        lang: "elasticsearch",
        scroll: searchParams.scrollTTL,
        size: searchParams.size,
      },
    );
  }

  async searchDevices(
    searchParams: Partial<SearchParams>,
  ): Promise<SearchResult<KHit<DeviceModelContent>>> {
    const query = {
      bool: {
        must: [searchParams.searchBody.query, { match: { type: "device" } }],
      },
    };

    return this.sdk.document.search<DeviceModelContent>(
      this.config.adminIndex,
      InternalCollection.MODELS,
      {
        ...searchParams.searchBody,
        query,
      },
      {
        from: searchParams.from,
        lang: "elasticsearch",
        scroll: searchParams.scrollTTL,
        size: searchParams.size,
      },
    );
  }

  async searchMeasures(
    searchParams: Partial<SearchParams>,
  ): Promise<SearchResult<KHit<MeasureModelContent>>> {
    const query = {
      bool: {
        must: [searchParams.searchBody.query, { match: { type: "measure" } }],
      },
    };

    return this.sdk.document.search<MeasureModelContent>(
      this.config.adminIndex,
      InternalCollection.MODELS,
      {
        ...searchParams.searchBody,
        query,
      },
      {
        from: searchParams.from,
        lang: "elasticsearch",
        scroll: searchParams.scrollTTL,
        size: searchParams.size,
      },
    );
  }

  async assetExists(model: string): Promise<boolean> {
    const query = {
      and: [
        { equals: { type: "asset" } },
        { equals: { "asset.model": model } },
      ],
    };

    const result = await this.sdk.document.search(
      this.config.adminIndex,
      InternalCollection.MODELS,
      { query },
      { lang: "koncorde", size: 1 },
    );

    return result.total > 0;
  }

  async deviceExists(model: string): Promise<boolean> {
    const query = {
      and: [
        { equals: { type: "device" } },
        { equals: { "device.model": model } },
      ],
    };

    const result = await this.sdk.document.search(
      this.config.adminIndex,
      InternalCollection.MODELS,
      { query },
      { lang: "koncorde", size: 1 },
    );

    return result.total > 0;
  }

  async getAsset(
    engineGroup: string,
    model: string,
  ): Promise<KDocument<AssetModelContent>> {
    const query = {
      and: [
        {
          or: [
            { equals: { engineGroup } },
            { equals: { engineGroup: "commons" } },
          ],
        },
        { equals: { type: "asset" } },
        { equals: { "asset.model": model } },
      ],
    };

    const result = await this.sdk.document.search<AssetModelContent>(
      this.config.adminIndex,
      InternalCollection.MODELS,
      { query },
      { lang: "koncorde", size: 1 },
    );

    if (result.total === 0) {
      throw new NotFoundError(`Unknown Asset model "${model}".`);
    }

    return result.hits[0];
  }

  async getDevice(model: string): Promise<KDocument<DeviceModelContent>> {
    const query = {
      and: [
        { equals: { type: "device" } },
        { equals: { "device.model": model } },
      ],
    };

    const result = await this.sdk.document.search<DeviceModelContent>(
      this.config.adminIndex,
      InternalCollection.MODELS,
      { query },
      { lang: "koncorde", size: 1 },
    );

    if (result.total === 0) {
      throw new NotFoundError(`Unknown Device model "${model}".`);
    }

    return result.hits[0];
  }

  async getMeasure(type: string): Promise<KDocument<MeasureModelContent>> {
    const query = {
      and: [
        { equals: { type: "measure" } },
        { equals: { "measure.type": type } },
      ],
    };

    const result = await this.sdk.document.search<MeasureModelContent>(
      this.config.adminIndex,
      InternalCollection.MODELS,
      { query },
      { lang: "koncorde", size: 1 },
    );

    if (result.total === 0) {
      throw new NotFoundError(`Unknown Measure type "${type}".`);
    }

    return result.hits[0];
  }

  /**
   * Update an asset model
   */
  async updateAsset(
    engineGroup: string,
    model: string,
    metadataMappings: MetadataMappings,
    defaultMetadata: JSONObject,
    metadataDetails: MetadataDetails,
    metadataGroups: MetadataGroups,
    measures: AssetModelContent["asset"]["measures"],
    tooltipModels: TooltipModels,
    locales: { [valueName: string]: LocaleDetails },
    request: KuzzleRequest,
  ): Promise<KDocument<AssetModelContent>> {
    if (Inflector.pascalCase(model) !== model) {
      throw new BadRequestError(`Asset model "${model}" must be PascalCase.`);
    }

    this.checkDefaultValues(metadataMappings, defaultMetadata);

    const existingAsset = await this.getAsset(engineGroup, model);

    // The field must be deleted if an element of the table is to be deleted
    await this.sdk.document.deleteFields(
      this.config.adminIndex,
      InternalCollection.MODELS,
      existingAsset._id,
      ["asset.tooltipModels"],
      { source: true },
    );

    const measuresUpdated =
      measures.length === 0 ? existingAsset._source.asset.measures : measures;

    const assetModelContent: AssetModelContent = {
      asset: {
        defaultMetadata,
        locales,
        measures: measuresUpdated,
        metadataDetails,
        metadataGroups,
        metadataMappings,
        model,
        tooltipModels,
      },
      engineGroup,
      type: "asset",
    };
    const assetModel = {
      _id: existingAsset._id,
      _source: assetModelContent,
    };

    const conflicts = await ask<AskEngineUpdateConflict>(
      "ask:device-manager:engine:doesUpdateConflict",
      { twin: { models: [assetModelContent], type: "asset" } },
    );

    if (conflicts.length > 0) {
      throw new MappingsConflictsError(
        `Assets mappings are causing conflicts`,
        conflicts,
      );
    }

    const endDocument = await this.updateDocument<AssetModelContent>(
      request,
      assetModel,
      {
        collection: InternalCollection.MODELS,
        engineId: this.config.adminIndex,
      },
      { source: true },
    );

    await this.sdk.collection.refresh(
      this.config.adminIndex,
      InternalCollection.MODELS,
    );
    await ask<AskEngineUpdateAll>("ask:device-manager:engine:updateAll");

    await ask<AskAssetRefreshModel>("ask:device-manager:asset:refresh-model", {
      assetModel: assetModelContent,
    });

    return endDocument;
  }
}
