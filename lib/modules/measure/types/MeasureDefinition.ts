import { SchemaObject } from "ajv";
import { JSONObject } from "kuzzle-sdk";
import { LocaleDetails } from "lib/modules/model";

/* *
 * Represents a measure information and localization
 *
 * @example
 * {
 *  en: {
 *    friendlyName: "Temperature",
 *    unit: "°C",
 *  },
 *  fr: {
 *    friendlyName: "Température",
 *    unit: "°C",
 *  },
 *}
 */

interface MeasureLocales {
  [localeString: string]: {
    friendlyName: string;
    unit?: string;
  };
}

export interface MeasureValuesDetails {
  [valueName: string]: MeasureLocales;
}
/**
 * Represents a measure definition registered by the Device Manager
 *
 * @example
 * {
 *   valuesMappings: { temperature: { type: 'float' } },
 *   validationSchema: {
        type: "object",
        properties: {
            temperature: { 
              type: "number",
              multipleOf: 0.01
            }
        },
        required: ["temperature"],
        additionalProperties: false
    }
 * },
 *{
 * valuesMappings: { temperature: { type: "float" } },
 * valuesDetails: {
 *   temperature: {
 *     en: {
 *       friendlyName: "Temperature",
 *       unit: "°C",
 *     },
 *     fr: {
 *       friendlyName: "Température",
 *       unit: "°C",
 *     },
 *   },
 * },
 *}
 */

export interface MeasureDefinition {
  locales?: {
    [valueName: string]: LocaleDetails;
  };
  /**
   * Mappings for the measurement values in order to index the fields
   */
  valuesMappings: JSONObject;
  /**
   * Schema to validate the values against
   */
  validationSchema?: SchemaObject;

  valuesDetails?: {
    [valueName: string]: MeasureLocales;
  };
}
