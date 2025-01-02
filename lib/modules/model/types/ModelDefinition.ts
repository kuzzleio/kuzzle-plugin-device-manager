import { JSONObject } from "kuzzle-sdk";
import { Decoder, NamedMeasures } from "../../../modules/decoder";
import {
  LocaleDetails,
  MetadataDetails,
  MetadataGroups,
  MetadataMappings,
  TooltipModels,
} from "./ModelContent";

/**
 * Define an asset model
 *
 * @example
 *   {
 *     measures: [
 *       { name: "temperatureExt", type: "temperature" },
 *       { name: "temperatureInt", type: "temperature" },
 *       { name: "position", type: "position" },
 *     ],
 *     metadataMappings: {
 *       weight: { type: "integer" },
 *       height: { type: "integer" },
 *     },
 *     defaultMetadata: {
 *       height: 20
 *     },
 *     metadataDetails: {
 *       "extTemp": {
 *         "group": "buildingEnv",
 *         "locales": {
 *           "en": {
 *             "friendlyName": "External temperature",
 *             "description": "Container external temperature"
 *           },
 *           "fr": {
 *             "friendlyName": "Température externe",
 *             "description": "Température externe du conteneur"
 *           }
 *         },
 *         "definition": {
 *           "readOnly": false,
 *           "type": MetadataDetailsEnum.DATETIME,
 *           "date": true,
 *           "time": true,
 *           "customTimeZoneAllowed": true,
 *        },
 *       },
 *     },
 *     metadataGroups: {
 *       buildingEnv: {
 *         locales: {
 *           en: {
 *             groupFriendlyName: "Building environment",
 *             description: "The building environment"
 *           },
 *           fr: {
 *             groupFriendlyName: "Environnement du bâtiment",
 *             description: "L'environnement du bâtiment"
 *           }
 *         }
 *       }
 *     },
 *     tooltipModels: {
 *       "defaultTooltipKey": {
 *         "tooltipLabel": "Default Tooltip Model",
 *         "content": [
 *           {
 *             "category": "metadata",
 *             "label": {
 *               "locales": {
 *                 "en": {
 *                   "friendlyName": "Container position",
 *                   "description": ""
 *                 },
 *                 "fr": {
 *                   "friendlyName": "Position du conteneur",
 *                   "description": ""
 *                 }
 *               }
 *             },
 *             "metadataPath": "geolocation"
 *           },
 *           {
 *             "category": "measure",
 *             "label": {
 *               "locales": {
 *                 "en": {
 *                   "friendlyName": "External temperature",
 *                   "description": ""
 *                 },
 *                 "fr": {
 *                   "friendlyName": "Température extérieure",
 *                   "description": ""
 *                 }
 *               }
 *             },
 *             "measureSlot": "externalTemperature",
 *             "measureValuePath": "externalTemperature",
 *             "suffix": "°C"
 *           }
 *         ]
 *       }
 *     }
 *   }
 *
 */
export type AssetModelDefinition = {
  /**
   * Array describing measures names and types
   */
  measures: NamedMeasures;

  /**
   * Metadata mappings definition
   */
  metadataMappings?: MetadataMappings;

  /**
   * Default metadata values
   */
  defaultMetadata?: JSONObject;

  /**
   * Metadata details including tanslations and group.
   */
  metadataDetails?: MetadataDetails;

  /**
   * Metadata groups
   */
  metadataGroups?: MetadataGroups;

  /**
   * Tooltip models
   */
  tooltipModels?: TooltipModels;

  locales?: { [valueName: string]: LocaleDetails };
};

/**
 * Define a device model
 *
 * @example
 *   {
 *     decoder: new DummyTempPositionDecoder(),
 *     metadataMappings: {
 *       serial: { type: "keyword" },
 *     },
 *     defaultMetadata: {
 *       company: "Firebird"
 *     },
 *     metadataDetails: {
 *       sensorType: {
 *         group: "sensorSpecs",
 *         locales: {
 *           en: {
 *             friendlyName: "Sensor type",
 *             description: "Type of the sensor"
 *           },
 *           fr: {
 *             friendlyName: "Type de traceur",
 *             description: "Type du traceur"
 *           }
 *         },
 *         definition: {
 *           readOnly: false,
 *           type: MetadataDetailsEnum.DATETIME,
 *           date: true,
 *           time: true,
 *           customTimeZoneAllowed: true,
 *        },
 *       },
 *     },
 *     metadataGroups: {
 *      sensorSpecs: {
 *        locales: {
 *          en: {
 *            groupFriendlyName: "Sensor specifications",
 *            description : "All sensors specifications"
 *          },
 *          fr: {
 *            groupFriendlyName: "Spécifications techniques",
 *            description: "Toutes les spécifications techniques"
 *          }
 *        }
 *      }
 *    }
 *  }
 */
export type DeviceModelDefinition = {
  /**
   * Decoder used to decode payloads
   */
  decoder: Decoder;

  /**
   * Metadata mappings definition
   */
  metadataMappings?: MetadataMappings;

  /**
   * Default metadata values
   */
  defaultMetadata?: JSONObject;

  /**
   * Metadata details including tanslations and group.
   */
  metadataDetails?: MetadataDetails;

  /**
   * Metadata groups list and details.
   */
  metadataGroups?: MetadataGroups;
};
