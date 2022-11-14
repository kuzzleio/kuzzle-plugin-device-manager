import { JSONObject, KDocumentContent } from "kuzzle";

import { Metadata } from "../../../modules/shared";
import { AssetMeasureContext } from "../../../modules/asset";

/**
 * Represents the content of a measure document.
 */
export interface MeasureContent<
  TMeasureValues extends JSONObject = JSONObject,
  TMetadata extends Metadata = Metadata
> extends Measurement<TMeasureValues>,
    KDocumentContent {
  /**
   * Asset linked to the device when the measure was made
   */
  asset?: AssetMeasureContext<TMetadata>;

  /**
   * Define the origin of the measure.
   */
  origin: {
    /**
     * Name of the measure (e.g. from the Device)
     */
    measureName: string;

    /**
     * Type of the origin
     */
    type: "user" | "device";

    /**
     * Payload uuids that were used to create this measure.
     */
    payloadUuids?: Array<string>;

    /**
     * Model of the device
     *
     * @example "AbeewayTemp"
     */
    deviceModel?: string;

    /**
     * Reference of the device
     */
    reference?: string;

    /**
     * ID of the origin. Can be:
     * - device id if origin type is `device`
     * - kuid of the request if origin type is `user`
     */
    id?: string;
  };
}

export type Measurement<TMeasureValues extends JSONObject = JSONObject> = {
  /**
   * Type of the measure. (e.g. "temperature")
   */
  type: string;

  /**
   * Micro Timestamp of the measurement time.
   */
  measuredAt: number;

  /**
   * Property containing the actual measurement.
   *
   * This should be specialized by child interfaces.
   */
  values: TMeasureValues;
};

/**
 * Used in the DecodedPayload to store a decoded measure
 */
export type DecodedMeasurement<TMeasureValues extends JSONObject = JSONObject> =
  {
    measureName: string;
  } & Measurement<TMeasureValues>;
