import { JSONObject, KDocument, KHit, SearchResult } from "kuzzle-sdk";

import { DecodedMeasurement, MeasureContent } from "../../measure";
import { AssetContent } from "../../asset";
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

import { DeviceContent } from "./DeviceContent";

type DevicesControllerName = "device-manager/devices";

interface DevicesControllerRequest {
  controller: DevicesControllerName;

  engineId: string;
}

export interface ApiDeviceGetRequest extends DevicesControllerRequest {
  action: "get";

  _id: string;
}
export type ApiDeviceGetResult = KDocument<DeviceContent>;

export interface ApiDeviceUpdateRequest extends DevicesControllerRequest {
  action: "update";

  _id: string;

  refresh?: string;

  body: {
    metadata: Metadata;
  };
}
export type ApiDeviceUpdateResult = KDocument<DeviceContent>;

export type ApiDeviceMetadataReplaceResult = KDocument<DeviceContent>;

export interface ApiDeviceUpsertRequest extends DevicesControllerRequest {
  action: "upsert";

  refresh?: string;

  body: {
    model: string;

    reference: string;

    metadata: Metadata;
  };
}

export type ApiDeviceUpsertResult = KDocument<DeviceContent>;

export interface ApiDeviceCreateRequest extends DevicesControllerRequest {
  action: "create";

  refresh?: string;

  body: {
    model: string;

    reference: string;

    metadata?: Metadata;
  };
}
export type ApiDeviceCreateResult = KDocument<DeviceContent>;

export interface ApiDeviceDeleteRequest extends DevicesControllerRequest {
  action: "delete";

  _id: string;

  refresh?: string;

  strict?: boolean;
}
export type ApiDeviceDeleteResult = void;

export interface ApiDeviceSearchRequest extends DevicesControllerRequest {
  action: "search";

  from?: number;

  size?: number;

  scrollTTL?: string;

  lang?: "koncorde" | "elasticsearch";

  body: JSONObject;
}
export type ApiDeviceSearchResult = SearchResult<KHit<DeviceContent>>;

export interface ApiDeviceUnlinkAssetRequest extends DevicesControllerRequest {
  action: "unlinkAsset";

  _id: string;

  strict?: boolean;

  refresh?: string;
}
export type ApiDeviceUnlinkAssetResult = {
  asset: KDocument<AssetContent>;
  device: KDocument<DeviceContent>;
};

export interface ApiDeviceAttachEngineRequest extends DevicesControllerRequest {
  action: "attachEngine";

  _id: string;

  refresh?: string;
}
export type ApiDeviceAttachEngineResult = void;

export interface ApiDeviceDetachEngineRequest extends DevicesControllerRequest {
  action: "detachEngine";

  _id: string;

  refresh?: string;
}
export type ApiDeviceDetachEngineResult = void;

export interface ApiDeviceLinkAssetRequest extends DevicesControllerRequest {
  action: "linkAsset";

  _id: string;

  refresh?: string;

  assetId: string;

  /**
   * This option allows to not specify the names of all the measures that should
   * be linked to the asset.
   *
   * The algorithm will go through all the measures names provided by the device
   * and add the one who are present with the same name in the asset.
   *
   * It will not add the measure if:
   *   - it has been specified in the link request
   *   - it was already present in the asset
   *
   * @example
   *   if the device provide a measure of type "temperature" with the name "temp"
   *   if the asset has declared a measure of type "temperature" with the name "temp"
   *   then the measure will be automatically added in the link and will later be propagated to the asset
   */
  implicitMeasuresLinking?: boolean;

  body?: {
    /**
     * Names of the linked measures.
     *
     * Array<{ asset: string, device: string }>
     *
     * @example
     *
     * [
     *   { asset: "externalTemperature", device: "temperature" }
     * ]
     */
    measureNames?: Array<{ asset: string; device: string }>;
  };
}
export type ApiDeviceLinkAssetResult = {
  asset: KDocument<AssetContent>;
  device: KDocument<DeviceContent>;
};

export interface ApiDeviceGetMeasuresRequest extends DevicesControllerRequest {
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
export type ApiDeviceGetMeasuresResult = {
  measures: Array<KDocument<MeasureContent<JSONObject>>>;
  total: number;
};

export type ApiDeviceGetLastMeasuresRequest =
  ApiDigitalTwinGetLastMeasuresRequest<DevicesControllerName>;
export type ApiDeviceGetLastMeasuresResult =
  ApiDigitalTwinGetLastMeasuresResult;

export type ApiDeviceMGetLastMeasuresRequest =
  ApiDigitalTwinMGetLastMeasuresRequest<DevicesControllerName>;
export type ApiDeviceMGetLastMeasuresResult =
  ApiDigitalTwinMGetLastMeasuresResult;

/**
 * This action can be used only with WebSocket or POST
 *
 * Then the export can be download using HTTP Get and the following route:
 *  `/_/device-manager/:engineId/devices/:_id/measures/_export/:exportId`
 */
export interface ApiDeviceExportMeasuresRequest
  extends DevicesControllerRequest {
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
export type ApiDeviceExportMeasuresResult = {
  link: string;
};

export interface ApiDeviceReceiveMeasuresRequest<
  TMeasureValues extends JSONObject = JSONObject,
> extends DevicesControllerRequest {
  action: "receiveMeasures";

  _id: string;

  body: {
    payloadUuids?: string[];
    measures: Array<{
      measureName: DecodedMeasurement<TMeasureValues>["measureName"];
      measuredAt?: DecodedMeasurement<TMeasureValues>["measuredAt"];
      type: DecodedMeasurement<TMeasureValues>["type"];
      values: DecodedMeasurement<TMeasureValues>["values"];
    }>;
  };
}
export type ApiDeviceReceiveMeasuresResult = void;

export interface ApiDeviceExportRequest extends DevicesControllerRequest {
  action: "export";

  lang?: "koncorde" | "elasticsearch";

  body?: {
    query?: JSONObject;
    sort?: JSONObject;
  };
}
export type ApiDeviceExportResult = {
  link: string;
};

export type ApiDeviceGetLastMeasuredAtRequest =
  ApiDigitalTwinGetLastMeasuredAtRequest<DevicesControllerName>;
export type ApiDeviceGetLastMeasuredAtResult =
  ApiDigitalTwinGetLastMeasuredAtResult;

export type ApiDeviceMGetLastMeasuredAtRequest =
  ApiDigitalTwinMGetLastMeasuredAtRequest<DevicesControllerName>;
export type ApiDeviceMGetLastMeasuredAtResult =
  ApiDigitalTwinMGetLastMeasuredAtResult;
