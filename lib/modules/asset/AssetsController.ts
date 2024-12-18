import {
  BadRequestError,
  ControllerDefinition,
  HttpStream,
  JSONObject,
  KuzzleError,
  KuzzleRequest,
} from "kuzzle";

import {
  AskMeasureSourceIngest,
  DecodedMeasurement,
  MeasureExporter,
} from "../measure/";
import { DeviceManagerPlugin, InternalCollection } from "../plugin";
import { DigitalTwinExporter, EmbeddedMeasure } from "../shared";

import { AssetService } from "./AssetService";
import { AssetSerializer } from "./model/AssetSerializer";
import {
  ApiAssetCreateResult,
  ApiAssetUpsertResult,
  ApiAssetDeleteResult,
  ApiAssetGetMeasuresResult,
  ApiAssetGetResult,
  ApiAssetSearchResult,
  ApiAssetUpdateResult,
  ApiAssetMigrateTenantResult,
  ApiAssetMetadataReplaceResult,
  ApiAssetGetLastMeasuresResult,
  ApiAssetMGetLastMeasuredAtResult,
  ApiAssetMGetLastMeasuresResult,
  ApiAssetGetLastMeasuredAtResult,
} from "./types/AssetApi";
import { isSourceApi } from "../measure/types/MeasureSources";
import { getValidator } from "../shared/utils/AJValidator";
import { ask } from "kuzzle-plugin-commons";
import { toApiTarget } from "../measure/MeasureTargetBuilder";
import { DATA_SOURCE_METADATA_TYPE } from "../measure/MeasureSourcesBuilder";
import {
  MeasureValidationError,
  MeasureValidationChunks,
} from "../measure/MeasureValidationError";
import { AskModelAssetGet } from "../model";
import { AssetContent } from "./exports";

export class AssetsController {
  public definition: ControllerDefinition;
  private exporter: DigitalTwinExporter;
  private measureExporter: MeasureExporter;

  constructor(
    private plugin: DeviceManagerPlugin,
    private assetService: AssetService,
  ) {
    /* eslint-disable sort-keys */
    this.definition = {
      actions: {
        create: {
          handler: this.create.bind(this),
          http: [{ path: "device-manager/:engineId/assets", verb: "post" }],
        },
        upsert: {
          handler: this.upsert.bind(this),
          http: [{ path: "device-manager/:engineId/assets", verb: "put" }],
        },
        delete: {
          handler: this.delete.bind(this),
          http: [
            { path: "device-manager/:engineId/assets/:_id", verb: "delete" },
          ],
        },
        get: {
          handler: this.get.bind(this),
          http: [{ path: "device-manager/:engineId/assets/:_id", verb: "get" }],
        },
        search: {
          handler: this.search.bind(this),
          http: [
            { path: "device-manager/:engineId/assets/_search", verb: "post" },
            { path: "device-manager/:engineId/assets/_search", verb: "get" },
          ],
        },
        update: {
          handler: this.update.bind(this),
          http: [{ path: "device-manager/:engineId/assets/:_id", verb: "put" }],
        },
        replaceMetadata: {
          handler: this.replaceMetadata.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/:_id/metadata",
              verb: "patch",
            },
          ],
        },
        getMeasures: {
          handler: this.getMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/:_id/measures",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/assets/:_id/measures",
              verb: "post",
            },
          ],
        },
        getLastMeasures: {
          handler: this.getLastMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/:_id/lastMeasures",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/assets/:_id/lastMeasures",
              verb: "post",
            },
          ],
        },
        mGetLastMeasures: {
          handler: this.mGetLastMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/_mGetLastMeasures",
              verb: "post",
            },
          ],
        },
        mMeasureIngest: {
          handler: this.mMeasureIngest.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/:assetId/_mMeasureIngest",
              verb: "post",
            },
          ],
        },
        measureIngest: {
          handler: this.measureIngest.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/:assetId/measures/:slotName",
              verb: "post",
            },
          ],
        },
        exportMeasures: {
          handler: this.exportMeasures.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/:_id/measures/_export/:exportId",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/assets/:_id/measures/_export",
              verb: "post",
            },
          ],
        },
        export: {
          handler: this.export.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/_export/:exportId",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/assets/_export",
              verb: "post",
            },
          ],
        },
        migrateTenant: {
          handler: this.migrateTenant.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/_migrateTenant",
              verb: "post",
            },
          ],
        },
        getLastMeasuredAt: {
          handler: this.getLastMeasuredAt.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/:_id/lastMeasuredAt",
              verb: "get",
            },
            {
              path: "device-manager/:engineId/assets/:_id/lastMeasuredAt",
              verb: "post",
            },
          ],
        },
        mGetLastMeasuredAt: {
          handler: this.mGetLastMeasuredAt.bind(this),
          http: [
            {
              path: "device-manager/:engineId/assets/_mGetLastMeasuredAt",
              verb: "post",
            },
          ],
        },
      },
    };
    /* eslint-enable sort-keys */

    this.exporter = new DigitalTwinExporter(
      this.plugin,
      InternalCollection.ASSETS,
    );
    this.measureExporter = new MeasureExporter(
      this.plugin,
      InternalCollection.ASSETS,
    );
  }

  async get(request: KuzzleRequest): Promise<ApiAssetGetResult> {
    const assetId = request.getId();
    const engineId = request.getString("engineId");

    const asset = await this.assetService.get(engineId, assetId, request);

    return AssetSerializer.serialize(asset);
  }

  async upsert(request: KuzzleRequest): Promise<ApiAssetUpsertResult> {
    const engineId = request.getString("engineId");
    const model = request.getBodyString("model");
    const reference = request.getBodyString("reference");
    const metadata = request.getBodyObject("metadata");

    const upsertAsset = await this.assetService.upsert(
      engineId,
      model,
      reference,
      metadata,
      request,
    );

    return AssetSerializer.serialize(upsertAsset);
  }

  async update(request: KuzzleRequest): Promise<ApiAssetUpdateResult> {
    const assetId = request.getId();
    const engineId = request.getString("engineId");
    const metadata = request.getBodyObject("metadata");

    const updatedAsset = await this.assetService.update(
      engineId,
      assetId,
      metadata,
      request,
    );

    return AssetSerializer.serialize(updatedAsset);
  }

  async replaceMetadata(
    request: KuzzleRequest,
  ): Promise<ApiAssetMetadataReplaceResult> {
    const assetId = request.getId();
    const engineId = request.getString("engineId");
    const metadata = request.getBodyObject("metadata");

    const updatedAsset = await this.assetService.replaceMetadata(
      engineId,
      assetId,
      metadata,
      request,
    );

    return AssetSerializer.serialize(updatedAsset);
  }

  async create(request: KuzzleRequest): Promise<ApiAssetCreateResult> {
    const engineId = request.getString("engineId");
    const model = request.getBodyString("model");
    const reference = request.getBodyString("reference");
    const metadata = request.getBodyObject("metadata", {});

    const asset = await this.assetService.create(
      engineId,
      model,
      reference,
      metadata,
      request,
    );

    return AssetSerializer.serialize(asset);
  }

  async delete(request: KuzzleRequest): Promise<ApiAssetDeleteResult> {
    const engineId = request.getString("engineId");
    const assetId = request.getId();

    await this.assetService.delete(engineId, assetId, request);
  }

  async search(request: KuzzleRequest): Promise<ApiAssetSearchResult> {
    return this.assetService.search(
      request.getString("engineId"),
      request.getSearchParams(),
      request,
    );
  }

  async getMeasures(
    request: KuzzleRequest,
  ): Promise<ApiAssetGetMeasuresResult> {
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
      {
        from,
        size,
      },
    );

    return { measures, total };
  }

  async getLastMeasures(
    request: KuzzleRequest,
  ): Promise<ApiAssetGetLastMeasuresResult> {
    const assetId = request.getId();
    const engineId = request.getString("engineId");
    const measureCount = request.getNumber("measureCount", 100);

    const results = await this.assetService.getLastMeasures(
      engineId,
      assetId,
      measureCount,
    );

    return results.reduce<ApiAssetGetLastMeasuresResult>(
      (accumulator, result) => {
        const measure: EmbeddedMeasure = {
          measuredAt: result.measuredAt,
          name: result.asset.measureName,
          originId: result.origin._id,
          payloadUuids: result.origin.payloadUuids,
          type: result.type,
          values: result.values,
        };

        return {
          ...accumulator,
          [result.asset.measureName]: measure,
        };
      },
      {},
    );
  }

  async mGetLastMeasures(
    request: KuzzleRequest,
  ): Promise<ApiAssetMGetLastMeasuresResult> {
    const engineId = request.getString("engineId");
    const measureCount = request.getNumber("measureCount", 100);
    const assetIds = request.getBodyArray("ids");

    const results = await this.assetService.mGetLastMeasures(
      engineId,
      assetIds,
      measureCount,
    );

    const response: ApiAssetMGetLastMeasuresResult = {};

    for (const [assetId, measures] of Object.entries(results)) {
      response[assetId] = measures.reduce<ApiAssetGetLastMeasuresResult>(
        (accumulator, result) => {
          const measure: EmbeddedMeasure = {
            measuredAt: result.measuredAt,
            name: result.asset.measureName,
            originId: result.origin._id,
            payloadUuids: result.origin.payloadUuids,
            type: result.type,
            values: result.values,
          };

          return {
            ...accumulator,
            [result.asset.measureName]: measure,
          };
        },
        {},
      );
    }

    return response;
  }

  /**
   *
   * @param indexId The asset index
   * @param assetId The target asset ID
   * @param measureName The measureName to get the type from
   * @param engineGroup The target engine group
   * @returns The measure type if used in the asset, null otherwise
   * @throws If the asset does not exists
   */
  private async getTypeFromMeasureSlot(
    indexId: string,
    assetId: string,
    measureName: string,
    engineGroup: string,
  ) {
    let asset: AssetContent;
    try {
      const assetDocument =
        await this.plugin.context.accessors.sdk.document.get<AssetContent>(
          indexId,
          InternalCollection.ASSETS,
          assetId,
        );

      asset = assetDocument._source;
    } catch (error) {
      throw new BadRequestError(
        `Asset "${assetId}" does not exists on index "${indexId}"`,
      );
    }

    const assetModel = await ask<AskModelAssetGet>(
      "ask:device-manager:model:asset:get",
      {
        engineGroup,
        model: asset.model,
      },
    );

    return (
      assetModel.asset.measures.find((elt) => elt.name === measureName)?.type ??
      null
    );
  }

  async mMeasureIngest(request: KuzzleRequest) {
    const assetId = request.getString("assetId");
    const indexId = request.getString("engineId");
    const engineGroup = request.getString("engineGroup", "commons");
    const rawMeasurements = request.getBodyArray("measurements");
    const source = request.getBodyObject("dataSource");
    source.type = DATA_SOURCE_METADATA_TYPE.API;

    if (!isSourceApi(source)) {
      throw new BadRequestError(
        "The provided data source does not match the API source format",
      );
    }

    const measurements = rawMeasurements.map((elt) => {
      return {
        measureName: elt.slotName,
        measuredAt: elt.measuredAt,
        type: elt.type,
        values: elt.values,
      };
    }) as DecodedMeasurement<JSONObject>[];

    const target = toApiTarget(indexId, assetId, engineGroup);

    const errors: MeasureValidationChunks[] = [];
    for (const measure of measurements) {
      const type = await this.getTypeFromMeasureSlot(
        indexId,
        assetId,
        measure.measureName,
        engineGroup,
      );

      const validator = getValidator(type);

      if (validator) {
        const valid = validator(measure.values);

        if (!valid) {
          errors.push({
            measureName: measure.measureName,
            validationErrors: validator.errors ?? [],
          });
        }
      }
    }

    if (errors.length > 0) {
      throw new MeasureValidationError(
        "The provided measures do not comply with their respective schemas",
        errors,
      );
    }

    await ask<AskMeasureSourceIngest>("device-manager:measures:sourceIngest", {
      measurements,
      payloadUuids: [],
      source,
      target,
    });
  }

  async measureIngest(request: KuzzleRequest) {
    const assetId = request.getString("assetId");
    const indexId = request.getString("engineId");
    const measureName = request.getString("slotName");
    const engineGroup = request.getString("engineGroup", "commons");
    const source = request.getBodyObject("dataSource");
    source.type = DATA_SOURCE_METADATA_TYPE.API;

    if (!isSourceApi(source)) {
      throw new BadRequestError(
        "The provided data source does not match the API source format",
      );
    }

    const measuredAt = request.getBodyNumber("measuredAt");
    const values = request.getBodyObject("values");

    const type = await this.getTypeFromMeasureSlot(
      indexId,
      assetId,
      measureName,
      engineGroup,
    );

    if (!type) {
      throw new BadRequestError(
        `Slot name ${measureName} does not exist on Asset ${assetId}`,
      );
    }

    const measurement = {
      measureName,
      measuredAt,
      type,
      values,
    } as DecodedMeasurement<JSONObject>;

    const target = toApiTarget(indexId, assetId, engineGroup);

    const validator = getValidator(type);

    if (validator) {
      const valid = validator(values);

      if (!valid) {
        throw new MeasureValidationError(
          "The provided measure does not respect its schema",
          [
            {
              measureName: measureName,
              validationErrors: validator.errors ?? [],
            },
          ],
        );
      }
    }

    await ask<AskMeasureSourceIngest>("device-manager:measures:sourceIngest", {
      measurements: [measurement],
      payloadUuids: [],
      source,
      target,
    });
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
            "Content-Disposition": `attachment; filename="asset-${id}.csv"`,
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
            "Content-Disposition": `attachment; filename="${InternalCollection.ASSETS}.csv"`,
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

  async migrateTenant(
    request: KuzzleRequest,
  ): Promise<ApiAssetMigrateTenantResult> {
    const assetsList = request.getBodyArray("assetsList");
    const engineId = request.getString("engineId");
    const newEngineId = request.getBodyString("newEngineId");

    const { errors, successes } = await this.assetService.migrateTenant(
      request.getUser(),
      assetsList,
      engineId,
      newEngineId,
    );

    return { errors, successes };
  }

  async getLastMeasuredAt(
    request: KuzzleRequest,
  ): Promise<ApiAssetGetLastMeasuredAtResult> {
    const assetId = request.getId();
    const engineId = request.getString("engineId");

    const lastMeasuredAt = await this.assetService.getLastMeasuredAt(
      engineId,
      assetId,
    );

    return {
      lastMeasuredAt,
    };
  }

  async mGetLastMeasuredAt(
    request: KuzzleRequest,
  ): Promise<ApiAssetMGetLastMeasuredAtResult> {
    const engineId = request.getString("engineId");
    const assetIds = request.getBodyArray("ids");

    return this.assetService.mGetLastMeasuredAt(engineId, assetIds);
  }
}
