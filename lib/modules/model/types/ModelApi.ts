import { JSONObject, KDocument, KHit, SearchResult } from "kuzzle-sdk";

import {
  AssetModelContent,
  DeviceModelContent,
  LocaleDetails,
  MeasureModelContent,
  MetadataDetails,
  MetadataGroups,
  MetadataMappings,
  TooltipModels,
} from "./ModelContent";
import { SchemaObject } from "ajv";
import { MeasureValuesDetails } from "../../measure/types/MeasureDefinition";

interface ModelsControllerRequest {
  controller: "device-manager/models";
}

export interface ApiModelGetAssetRequest extends ModelsControllerRequest {
  action: "getAsset";
  model: string;
  engineGroup: string;
}
export type ApiModelGetAssetResult = KDocument<AssetModelContent>;

export interface ApiModelGetDeviceRequest extends ModelsControllerRequest {
  action: "getDevice";
  model: string;
}
export type ApiModelGetDeviceResult = KDocument<DeviceModelContent>;

export interface ApiModelGetMeasureRequest extends ModelsControllerRequest {
  action: "getMeasure";
  type: string;
}
export type ApiModelGetMeasureResult = KDocument<MeasureModelContent>;

export interface ApiModelWriteAssetRequest extends ModelsControllerRequest {
  action: "writeAsset";

  body: {
    engineGroup: string;
    model: string;
    metadataDetails?: MetadataDetails;
    metadataGroups?: MetadataGroups;
    metadataMappings?: MetadataMappings;
    defaultValues?: JSONObject;
    measures?: AssetModelContent["asset"]["measures"];
    tooltipModels?: TooltipModels;
  };
}
export type ApiModelWriteAssetResult = KDocument<AssetModelContent>;

export interface ApiModelWriteDeviceRequest extends ModelsControllerRequest {
  action: "writeDevice";

  body: {
    model: string;
    metadataDetails?: MetadataDetails;
    metadataGroups?: MetadataGroups;
    metadataMappings?: MetadataMappings;
    defaultValues?: JSONObject;
    measures: DeviceModelContent["device"]["measures"];
  };
}
export type ApiModelWriteDeviceResult = KDocument<DeviceModelContent>;

export interface ApiModelWriteMeasureRequest extends ModelsControllerRequest {
  action: "writeMeasure";

  body: {
    type: string;
    locales?: {
      [valueName: string]: LocaleDetails;
    };
    valuesMappings: JSONObject;
    validationSchema?: SchemaObject;
    valuesDetails?: MeasureValuesDetails;
  };
}
export type ApiModelWriteMeasureResult = KDocument<MeasureModelContent>;

export interface ApiModelUpdateAssetRequest extends ModelsControllerRequest {
  action: "updateAsset";

  engineGroup: string;
  model: string;

  body: {
    metadataDetails?: MetadataDetails;
    metadataGroups?: MetadataGroups;
    metadataMappings?: MetadataMappings;
    defaultValues?: JSONObject;
    measures?: AssetModelContent["asset"]["measures"];
    tooltipModels?: TooltipModels;
  };
}
export type ApiModelUpdateAssetResult = KDocument<AssetModelContent>;

export interface ApiModelDeleteAssetRequest extends ModelsControllerRequest {
  action: "deleteAsset";

  _id: string;
}
export type ApiModelDeleteAssetResult = void;

export interface ApiModelDeleteDeviceRequest extends ModelsControllerRequest {
  action: "deleteDevice";

  _id: string;
}
export type ApiModelDeleteDeviceResult = void;

export interface ApiModelDeleteMeasureRequest extends ModelsControllerRequest {
  action: "deleteMeasure";

  _id: string;
}
export type ApiModelDeleteMeasureResult = void;

export interface ApiModelListAssetsRequest extends ModelsControllerRequest {
  action: "listAssets";

  engineGroup: string;
}
export type ApiModelListAssetsResult = {
  models: KDocument<AssetModelContent>[];
  total: number;
};

export interface ApiModelListDevicesRequest extends ModelsControllerRequest {
  action: "listDevices";
}
export type ApiModelListDevicesResult = {
  models: KDocument<DeviceModelContent>[];
  total: number;
};

export interface ApiModelListMeasuresRequest extends ModelsControllerRequest {
  action: "listMeasures";
}
export type ApiModelListMeasuresResult = {
  models: KDocument<MeasureModelContent>[];
  total: number;
};

export interface ApiModelSearchAssetsRequest extends ModelsControllerRequest {
  action: "searchAssets";

  engineGroup: string;
  from?: number;
  size?: number;
  scrollTTL?: string;
  body?: JSONObject;
}
export type ApiModelSearchAssetsResult = SearchResult<KHit<AssetModelContent>>;

export interface ApiModelSearchDevicesRequest extends ModelsControllerRequest {
  action: "searchDevices";

  from?: number;
  size?: number;
  scrollTTL?: string;
  body?: JSONObject;
}
export type ApiModelSearchDevicesResult = SearchResult<
  KHit<DeviceModelContent>
>;

export interface ApiModelSearchMeasuresRequest extends ModelsControllerRequest {
  action: "searchMeasures";

  from?: number;
  size?: number;
  scrollTTL?: string;
  body?: JSONObject;
}
export type ApiModelSearchMeasuresResult = SearchResult<
  KHit<MeasureModelContent>
>;
