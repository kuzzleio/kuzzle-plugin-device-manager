import { JSONObject, KDocument, KHit, SearchResult } from "kuzzle-sdk";

import { MeasureContent, Measurement } from "../../../modules/measure";
import {
  ApiDigitalTwinGetLastMeasuredAtRequest,
  ApiDigitalTwinGetLastMeasuredAtResult,
  ApiDigitalTwinGetLastMeasuresRequest,
  ApiDigitalTwinGetLastMeasuresResult,
  ApiDigitalTwinMGetLastMeasuredAtRequest,
  ApiDigitalTwinMGetLastMeasuredAtResult,
  ApiDigitalTwinMGetLastMeasuresRequest,
  ApiDigitalTwinMGetLastMeasuresResult,
  Metadata,
} from "../../shared";

import { AssetContent } from "./AssetContent";

type AssetsControllerName = "device-manager/assets";
import { ApiMeasureSource } from "../../measure/types/MeasureSources";

interface AssetsControllerRequest {
  controller: AssetsControllerName;

  engineId: string;

  /**
   * ? Request parameter used by SoftTenant module
   * ! Not used directly in this plugin
   */
  softTenantId?: string | string[] | null;
}

export interface ApiAssetGetRequest extends AssetsControllerRequest {
  action: "get";

  _id: string;
}
export type ApiAssetGetResult = KDocument<AssetContent>;

export interface ApiAssetUpdateRequest extends AssetsControllerRequest {
  action: "update";

  _id: string;

  refresh?: string;

  body: {
    metadata: Metadata;
  };
}
export type ApiAssetUpdateResult = KDocument<AssetContent>;

export interface ApiAssetMetadataReplaceRequest
  extends AssetsControllerRequest {
  action: "replaceMetadata";

  _id: string;

  refresh?: string;

  body: {
    metadata: Metadata;
  };
}
export type ApiAssetMetadataReplaceResult = KDocument<AssetContent>;

export interface ApiAssetUpsertRequest extends AssetsControllerRequest {
  action: "upsert";

  refresh?: string;

  body: {
    model: string;

    reference: string;

    metadata: Metadata;
  };
}
export type ApiAssetUpsertResult = KDocument<AssetContent>;

export interface ApiAssetCreateRequest extends AssetsControllerRequest {
  action: "create";

  refresh?: string;

  body: {
    model: string;

    reference: string;

    metadata?: Metadata;
  };
}
export type ApiAssetCreateResult = KDocument<AssetContent>;

export interface ApiAssetDeleteRequest extends AssetsControllerRequest {
  action: "delete";

  _id: string;

  refresh?: string;

  strict?: boolean;
}
export type ApiAssetDeleteResult = void;

export interface ApiAssetSearchRequest extends AssetsControllerRequest {
  action: "search";

  from?: number;

  size?: number;

  scrollTTL?: string;

  lang?: "koncorde" | "elasticsearch";

  body: JSONObject;
}
export type ApiAssetSearchResult = SearchResult<KHit<AssetContent>>;

export interface ApiAssetGetMeasuresRequest extends AssetsControllerRequest {
  action: "getMeasures";

  _id: string;

  size?: number;

  from?: number;

  startAt?: string;

  endAt?: string;

  type?: string;

  lang?: "koncorde" | "elasticsearch";

  body?: {
    query?: JSONObject;
    sort?: JSONObject;
  };
}
export type ApiAssetGetMeasuresResult = {
  measures: Array<KDocument<MeasureContent<JSONObject>>>;
  total: number;
};

type TypelessApiMeasureSource = Omit<ApiMeasureSource, "type">;

export interface ApiAssetMeasureIngestRequest extends AssetsControllerRequest {
  action: "measureIngest";

  assetId: string;

  engineId: string;
  engineGroup?: string;
  slotName: string;

  body: {
    dataSource: TypelessApiMeasureSource;
    measuredAt: number;
    values: JSONObject;
  };
}
export type ApiAssetMeasureIngestResult = void;

type APIDecodedMeasurement = Omit<Measurement, "type"> & { slotName: string };

export interface ApiAssetmMeasureIngestRequest extends AssetsControllerRequest {
  action: "mMeasureIngest";

  assetId: string;

  engineId: string;
  engineGroup?: string;

  body: {
    dataSource: TypelessApiMeasureSource;
    measurements: APIDecodedMeasurement[];
  };
}

export type ApiAssetmMeasureIngestResult = void;

export type ApiAssetGetLastMeasuresRequest =
  ApiDigitalTwinGetLastMeasuresRequest<AssetsControllerName>;
export type ApiAssetGetLastMeasuresResult = ApiDigitalTwinGetLastMeasuresResult;

export type ApiAssetMGetLastMeasuresRequest =
  ApiDigitalTwinMGetLastMeasuresRequest<AssetsControllerName>;
export type ApiAssetMGetLastMeasuresResult =
  ApiDigitalTwinMGetLastMeasuresResult;

/**
 * This action can be used only with WebSocket or POST
 *
 * Then the export can be download using HTTP Get and the following route:
 *  `/_/device-manager/:engineId/devices/:_id/measures/_export/:exportId`
 */
export interface ApiAssetExportMeasuresRequest extends AssetsControllerRequest {
  action: "exportMeasures";

  _id: string;

  startAt?: string;

  endAt?: string;

  type?: string;

  lang?: "koncorde" | "elasticsearch";

  body?: {
    query?: JSONObject;
    sort?: JSONObject;
  };
}
export type ApiAssetExportMeasuresResult = {
  link: string;
};

export interface ApiAssetExportRequest extends AssetsControllerRequest {
  action: "export";

  lang?: "koncorde" | "elasticsearch";

  body?: {
    query?: JSONObject;
    sort?: JSONObject;
  };
}
export type ApiAssetExportResult = {
  link: string;
};

export interface ApiAssetMigrateTenantRequest extends AssetsControllerRequest {
  action: "migrateTenant";
  engineId: string;
  body: {
    assetsList: string[];
    newEngineId: string;
  };
}
export type ApiAssetMigrateTenantResult = {
  errors: string[];
  successes: string[];
};

export type ApiAssetGetLastMeasuredAtRequest =
  ApiDigitalTwinGetLastMeasuredAtRequest<AssetsControllerName>;
export type ApiAssetGetLastMeasuredAtResult =
  ApiDigitalTwinGetLastMeasuredAtResult;

export type ApiAssetMGetLastMeasuredAtRequest =
  ApiDigitalTwinMGetLastMeasuredAtRequest<AssetsControllerName>;
export type ApiAssetMGetLastMeasuredAtResult =
  ApiDigitalTwinMGetLastMeasuredAtResult;
