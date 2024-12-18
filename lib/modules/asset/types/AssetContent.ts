import { JSONObject } from "kuzzle-sdk";

import { DigitalTwinContent, Metadata } from "../../shared";

/**
 * Asset document content
 */
export interface AssetContent<
  TMeasures extends JSONObject = any,
  TMetadata extends Metadata = any,
> extends DigitalTwinContent<TMeasures, TMetadata> {
  /**
   * Link with attached device
   */
  linkedDevices: Array<{
    /**
     * Device ID
     */
    _id: string;

    /**
     * Names of the linked measures
     *
     * Array<{ asset: string, device: string, type: string }>
     *
     * @example
     *
     * [
     *   { asset: "externalTemperature", device: "temperature", type: "temperature" }
     * ]
     */
    measureNames: Array<{ asset: string; device: string; type: string }>;
  }>;
  /**
   * Id's of asset groups
   */
  groups: Array<{
    id: string;
    date: number;
  }>;
  /**
   * Id's of soft tenants
   * ! Not used directly in this plugin
   */
  softTenant?: Array<string>;
}

/**
 * Asset description used to contextualize each measure data point
 */
export type AssetMeasureContext<TMetadata extends Metadata = Metadata> = {
  /**
   * ID of the asset
   */
  _id: string;

  /**
   * Name of the measure for the Asset
   */
  measureName: string;
} & Pick<
  AssetContent<JSONObject, TMetadata>,
  "model" | "reference" | "metadata" | "groups" | "softTenant"
>;
