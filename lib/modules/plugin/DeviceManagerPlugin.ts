import {
  BadRequestError,
  KuzzleRequest,
  Plugin,
  PluginContext,
  PluginImplementationError,
} from "kuzzle";
import { ConfigManager, EngineController } from "kuzzle-plugin-commons";
import { JSONObject } from "kuzzle-sdk";
import _ from "lodash";

import {
  batteryMeasureDefinition,
  humidityMeasureDefinition,
  MeasureDefinition,
  movementMeasureDefinition,
  positionMeasureDefinition,
  temperatureMeasureDefinition,
} from "../measure";

import { AssetModule, assetsMappings } from "../asset";
import {
  DecoderModule,
  DecodersRegister,
  NamedMeasures,
  payloadsMappings,
} from "../decoder";
import { DeviceModule, devicesMappings } from "../device";
import { MeasureModule } from "../measure";
import {
  AssetModelDefinition,
  DeviceModelDefinition,
  ModelModule,
  modelsMappings,
  ModelsRegister,
} from "../model";
import { keepStack, lock } from "../shared";

import { DeviceManagerEngine } from "./DeviceManagerEngine";
import { DeviceManagerConfiguration } from "./types/DeviceManagerConfiguration";
import { InternalCollection } from "./types/InternalCollection";

export class DeviceManagerPlugin extends Plugin {
  public config: DeviceManagerConfiguration;

  private deviceManagerEngine: DeviceManagerEngine;
  private adminConfigManager: ConfigManager;
  private engineConfigManager: ConfigManager;
  private engineController: EngineController<DeviceManagerPlugin>;

  private assetModule: AssetModule;
  private deviceModule: DeviceModule;
  private decoderModule: DecoderModule;
  private measureModule: MeasureModule;
  private modelModule: ModelModule;

  private modelsRegister: ModelsRegister;
  private decodersRegister: DecodersRegister;

  private get sdk() {
    return this.context.accessors.sdk;
  }

  get models() {
    return {
      /**
       * Register an asset model
       *
       * @param engineGroup Engine group name
       * @param model Name of the asset model. Must follow a naming convention in PascalCase.
       * @param definition Object containing the asset model definition, including:
       *        - measures: Array describing measure names and their types.
       *        - metadataMappings: Definition of metadata mappings, specifying types for each metadata field.
       *        - defaultMetadata: Default values for metadata fields, applied when actual data is not provided.
       *        - metadataDetails: Optional detailed descriptions for each metadata, including localizations, group association and definition.
       *        - metadataGroups: Optional description of metadata groups, organizing metadata logically, with localizations for group names.
       *        - tooltipModels: Optional tooltip model list, containing each labels and tooltip content to display.
       *
       * @example
       * ```
       * deviceManager.models.registerAsset(
       *   "logistic",
       *   "Container",
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
       *         "group": "environment",
       *         "locales": {
       *           "en": {
       *             "friendlyName": "External Temperature",
       *             "description": "The temperature outside the container"
       *           },
       *           "fr": {
       *             "friendlyName": "Température Externe",
       *             "description": "La température à l'extérieur du conteneur"
       *           }
       *         }
       *       }
       *     },
       *     metadataGroups: {
       *       "environment": {
       *         "locales": {
       *           "en": {
       *             "groupFriendlyName": "Environment"
       *           },
       *           "fr": {
       *             "groupFriendlyName": "Environnement"
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
       * );
       * ```
       */
      registerAsset: (
        engineGroup: string,
        model: string,
        definition: AssetModelDefinition,
      ) => {
        this.modelsRegister.registerAsset(
          engineGroup,
          model,
          definition.measures,
          definition.metadataMappings,
          definition.defaultMetadata,
          definition.metadataDetails,
          definition.metadataGroups,
          definition.tooltipModels,
          definition.locales,
        );
      },

      /**
       * Register a device.
       *
       * @param model Name of the device model
       * @param definition Object containing the device model definition, including:
       *                   - decoder: Decoder used to decode payloads
       *                   - metadataMappings: Metadata mappings definition
       *                   - defaultMetadata: Default metadata values
       *                   - metadataDetails: Localizations, detailed metadata descriptions and definition
       *                   - metadataGroups: Groups for organizing metadata, with localizations
       *
       * @example
       * ```
       * deviceManager.models.registerDevice(
       *   "Abeeway",
       *   {
       *     decoder: new DummyTempPositionDecoder(),
       *     metadataMappings: {
       *       serial: { type: "keyword" },
       *     },
       *     defaultMetadata: {
       *       company: "Acme Inc"
       *     },
       *     metadataDetails: {
       *       sensorVersion: {
       *         group: "sensorSpecs",
       *         locales: {
       *           en: {
       *             friendlyName: "Sensor version",
       *             description: "Firmware version of the sensor"
       *           },
       *           fr: {
       *             friendlyName: "Version du capteur",
       *             description: "Version du micrologiciel du capteur"
       *           }
       *         }
       *       }
       *     },
       *     metadataGroups: {
       *       sensorSpecs: {
       *         locales: {
       *           en: {
       *             groupFriendlyName: "Sensors specifications"
       *           },
       *           fr: {
       *             groupFriendlyName: "Spécifications des capteurs"
       *           }
       *         }
       *       }
       *     }
       *   }
       * );
       * ```
       */
      registerDevice: (model: string, definition: DeviceModelDefinition) => {
        this.decodersRegister.register(definition.decoder);
        definition.decoder.log = this.context?.log;

        this.modelsRegister.registerDevice(
          model,
          definition.decoder.measures as NamedMeasures,
          definition.metadataMappings,
          definition.defaultMetadata,
          definition.metadataDetails,
          definition.metadataGroups,
        );
      },

      /**
       * Register a new measure
       *
       * @param name Name of the measure
       * @param measureDefinition Values of the measure
       *
       * @example
       * ```
       * deviceManager.models.registerMeasure("acceleration", {
       *   x: { type: "float" },
       *   y: { type: "float" },
       *   z: { type: "float" },
       * });
       * ```
       */
      registerMeasure: (name: string, measureDefinition: MeasureDefinition) => {
        this.modelsRegister.registerMeasure(name, measureDefinition);
      },
    };
  }

  constructor() {
    super({
      kuzzleVersion: ">=2.20.2 <3",
    });

    /* eslint-disable sort-keys */
    this.api = {};
    this.pipes = {
      "generic:document:beforeWrite": [],
      "generic:document:beforeUpdate": [],
      "generic:document:beforeDelete": [],
    };
    this.hooks = {};
    this.imports = {
      roles: {},
      users: {},
      profiles: {},
      onExistingUsers: "skip",
    };

    this.config = {
      ignoreStartupErrors: false,
      engine: {
        autoUpdate: true,
      },
      adminIndex: "device-manager",
      adminCollections: {
        config: {
          name: "config",
          mappings: {
            dynamic: "strict",
            properties: {},
          },
        },
        devices: {
          name: "devices",
          mappings: devicesMappings,
        },
        payloads: {
          name: "payloads",
          mappings: payloadsMappings,
        },
      },
      engineCollections: {
        config: {
          name: "config",
          mappings: {
            dynamic: "strict",
            properties: {},
          },
        },
        asset: {
          name: InternalCollection.ASSETS,
          mappings: assetsMappings,
        },
        assetGroups: {
          name: InternalCollection.ASSETS_GROUPS,
        },
        assetHistory: {
          name: InternalCollection.ASSETS_HISTORY,
        },
        device: {
          name: InternalCollection.DEVICES,
          mappings: devicesMappings,
        },
        measures: {
          name: InternalCollection.MEASURES,
        },
      },
    };
    /* eslint-enable sort-keys */

    // Registers
    this.decodersRegister = new DecodersRegister();
    this.modelsRegister = new ModelsRegister();

    this.models.registerMeasure("temperature", temperatureMeasureDefinition);
    this.models.registerMeasure("position", positionMeasureDefinition);
    this.models.registerMeasure("movement", movementMeasureDefinition);
    this.models.registerMeasure("humidity", humidityMeasureDefinition);
    this.models.registerMeasure("battery", batteryMeasureDefinition);
  }

  /**
   * Init the plugin
   */
  async init(config: JSONObject, context: PluginContext) {
    this.config = _.merge({}, this.config, config);
    this.context = context;

    for (const decoder of this.decodersRegister.decoders) {
      decoder.log = this.context.log;
    }

    // Modules creation
    this.assetModule = new AssetModule(this);
    this.deviceModule = new DeviceModule(this);
    this.decoderModule = new DecoderModule(this);
    this.measureModule = new MeasureModule(this);
    this.modelModule = new ModelModule(this);

    // Modules init
    await this.assetModule.init();
    await this.deviceModule.init();
    await this.decoderModule.init();
    await this.measureModule.init();
    await this.modelModule.init();

    this.decodersRegister.init(this, this.context);
    this.modelsRegister.init(this);

    this.adminConfigManager = new ConfigManager(this, {
      mappings: this.config.adminCollections.config.mappings,
      settings: this.config.adminCollections.config.settings,
    });
    this.adminConfigManager.register("device-manager", {
      properties: {
        provisioningStrategy: { type: "keyword" },
      },
    });

    this.adminConfigManager.register("engine", {
      properties: {
        group: { type: "keyword" },
        index: { type: "keyword" },
        name: { type: "keyword" },
      },
    });

    this.engineConfigManager = new ConfigManager(this, {
      mappings: this.config.engineCollections.config.mappings,
      settings: this.config.engineCollections.config.settings,
    });

    this.deviceManagerEngine = new DeviceManagerEngine(
      this,
      this.adminConfigManager,
      this.engineConfigManager,
    );

    this.engineController = new EngineController(
      "device-manager",
      this,
      this.deviceManagerEngine,
    );

    this.decodersRegister.registerDefaultRights();
    this.decodersRegister.printDecoders();

    try {
      await this.initDatabase();
    } catch (error) {
      if (this.config.ignoreStartupErrors) {
        this.context.log.warn(
          `WARNING: An error occured during plugin initialization: ${error.message}`,
        );
      } else {
        throw error;
      }
    }

    if (this.config.ignoreStartupErrors) {
      this.context.log.warn(
        'WARNING: The "ignoreStartupErrors" option is enabled. Additional errors may appears at runtime.',
      );
    }
  }

  /**
   * Initialize the administration index of the plugin
   */
  private async initDatabase() {
    await lock("device-manager/initDatabase", async () => {
      if (!(await this.sdk.index.exists(this.config.adminIndex))) {
        // Possible race condition because of index cache propagation.
        // The index has been created but the node didn't receive the index
        // cache update message yet, causing index:exists to returns false
        try {
          await this.sdk.index.create(this.config.adminIndex);
        } catch (error) {
          if (!error.message.includes("already exists")) {
            throw error;
          }
        }
      }

      await this.adminConfigManager
        .createCollection(this.config.adminIndex)
        .catch((error) => {
          throw keepStack(
            error,
            new PluginImplementationError(
              `Cannot create admin "config" collection: ${error}`,
            ),
          );
        });

      await this.sdk.collection
        .create(this.config.adminIndex, InternalCollection.MODELS, {
          mappings: modelsMappings,
        })
        .catch((error) => {
          throw keepStack(
            error,
            new PluginImplementationError(
              `Cannot create admin "models" collection: ${error}`,
            ),
          );
        });
      await this.modelsRegister.loadModels();

      await this.deviceManagerEngine
        .createDevicesCollection(this.config.adminIndex)
        .catch((error) => {
          throw keepStack(
            error,
            new PluginImplementationError(
              `Cannot create admin "devices" collection: ${error}`,
            ),
          );
        });

      await this.sdk.collection
        .create(this.config.adminIndex, "payloads", {
          mappings: this.getPayloadsMappings(),
          settings: this.config.adminCollections.payloads.settings,
        })
        .catch((error) => {
          throw keepStack(
            error,
            new PluginImplementationError(
              `Cannot create admin "payloads" collection: ${error}`,
            ),
          );
        });

      await this.initializeConfig();

      if (this.config.engine.autoUpdate) {
        try {
          await this.deviceManagerEngine.updateEngines();
          await this.deviceManagerEngine.updateMeasuresSchema();
        } catch (error) {
          this.context.log.error(
            `An error occured while updating the engines during startup: ${error}`,
          );
        }
      }
    });
  }

  /**
   * Merge custom mappings defined in the Decoder into the "payloads" collection
   * mappings.
   *
   * Those custom mappings allow to search raw payloads more efficiently.
   */
  private getPayloadsMappings(): JSONObject {
    const { mappings } = JSON.parse(
      JSON.stringify(this.config.adminCollections.payloads),
    );

    for (const decoder of this.decodersRegister.decoders) {
      mappings.properties.payload.properties = {
        ...mappings.properties.payload.properties,
        ...decoder.payloadsMappings,
      };
    }

    return mappings;
  }

  /**
   * Initialize the config document if it does not exists
   */
  private async initializeConfig() {
    const exists = await this.sdk.document.exists(
      this.config.adminIndex,
      this.adminConfigManager.collection,
      "plugin--device-manager",
    );

    if (!exists) {
      await this.sdk.document.create(
        this.config.adminIndex,
        this.adminConfigManager.collection,
        {
          "device-manager": { provisioningStrategy: "auto" },
          type: "device-manager",
        },
        "plugin--device-manager",
      );
    }
  }

  private async pipeCheckEngine(request: KuzzleRequest) {
    const engineId = request.getString("engineId");

    if (engineId !== this.config.adminIndex) {
      const {
        result: { exists },
      } = await this.sdk.query({
        action: "exists",
        controller: "device-manager/engine",
        index: engineId,
      });

      if (!exists) {
        throw new BadRequestError(
          `Tenant "${engineId}" does not have a device-manager engine`,
        );
      }
    }

    return request;
  }
}
