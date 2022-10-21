import { JSONObject } from "kuzzle";

/**
 * Represents a measurement unit definition
 *
 * @example
 * {
 *   name: 'Degree',
 *   sign: '°',
 *   type: 'number',
 * }
 *
 */
export interface MeasureUnit {
  name: string;

  sign: string;

  type: string;
}

/**
 * Represents a measure definition registered by the Device Manager
 *
 * @example
 * {
 *   valuesMappings: { temperature: { type: 'float' } },
 *   unit: {
 *     name: 'Degree',
 *     sign: '°',
 *     type: 'number',
 *   },
 * }
 */
export interface MeasureDefinition {
  /**
   * Unit definition
   */
  unit: MeasureUnit;

  /**
   * Mappings for the measurement values in order to index the fields
   */
  valuesMappings: JSONObject;
}