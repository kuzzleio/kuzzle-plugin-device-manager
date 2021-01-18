import {
  Plugin,
  PluginContext,
  JSONObject,
  EmbeddedSDK,
  PluginImplementationError,
  Mutex,
} from 'kuzzle';

import {
  AssetController,
  SensorController,
  EngineController,
} from './controllers';
import { PayloadService } from './services';
import { Decoder } from './decoders';
import { sensorsMappings } from './models';

export class DeviceManager extends Plugin {
  private defaultConfig: JSONObject;

  private assetController: AssetController;
  private sensorController: SensorController;
  private engineController: EngineController;
  private payloadService: PayloadService;

  private get sdk (): EmbeddedSDK {
    return this.context.accessors.sdk;
  }

  /**
   * Define custom mappings for "sensors" and "assets" colections
   */
  public mappings: {
    /**
     * Define custom mappings for the "sensors" collection.
     */
    sensors: {
      /**
       * Define custom mappings for the "sensors.metadata" property
       */
      metadata: JSONObject;
      /**
       * Define custom mappings for the "sensors.qos" property
       */
      qos: JSONObject;
      /**
       * Define custom mappings for the "sensors.measures" property
       */
      measures: JSONObject;
    },
    /**
     * Define custom mappings for the "assets" collection.
     */
    assets: {
      /**
       * Define custom mappings for the "assets.metadata" property
       */
      metadata: JSONObject;
    },
  }

  /**
   * List of registered decoders.
   * Map<model, decoder>
   */
  private decoders = new Map<string, Decoder>();

  /**
   * Constructor
   */
  constructor() {
    super({
      kuzzleVersion: '>=2.9.0 <3'
    });

    this.mappings = {
      sensors: {
        metadata: {},
        qos: {},
        measures: {},
      },
      assets: {
        metadata: {},
      },
    };

    this.api = {
      'device-manager/payload': {
        actions: {}
      }
    };

    this.pipes = {
      'multi-tenancy/tenant:afterCreate': request => this.engineController.create(request),
      'multi-tenancy/tenant:afterDelete': request => this.engineController.delete(request),
    };

    this.defaultConfig = {
      adminIndex: 'device-manager',
      adminCollections: {
        engines: {
          dynamic: 'strict',
          properties: {
            index: { type: 'keyword' },
          }
        },
        sensors: sensorsMappings,
      },
      collections: {
        // assets collection
        assets: {
          dynamic: 'strict',
          properties: {
            model: { type: 'keyword' },
            reference: { type: 'keyword' },
            measures: {
              properties: {
                // autogenerated from sensors mappings
              }
            },
            metadata: {
              dynamic: 'false',
              properties: {}
            }
          }
        },
        // sensors collection
        sensors: sensorsMappings,
      }
    };
  }

  /**
   * Init the plugin
   */
  async init (config: JSONObject, context: PluginContext) {
    this.config = { ...this.defaultConfig, ...config };
    this.context = context;

    this.mergeCustomMappings();

    this.assetController = new AssetController(this.config, context);
    this.sensorController = new SensorController(this.config, context, this.decoders);
    this.engineController = new EngineController(this.config, context);

    this.api['device-manager/asset'] = this.assetController.definition;
    this.api['device-manager/sensor'] = this.sensorController.definition;
    this.api['device-manager/engine'] = this.engineController.definition;

    this.payloadService = new PayloadService(this.config, context);

    await this.initDatabase();

    for (const decoder of Array.from(this.decoders.values())) {
      this.context.log.info(`Register API action "device-manager/payload:${decoder.action}" with decoder for sensor "${decoder.sensorModel}"`);
    }
  }

  /**
   * Register a new decoder for a sensor model.
   *
   * This will register a new API action:
   *  - controller: `"device-manager/payload"`
   *  - action: `action` property of the decoder or the sensor model in kebab-case
   *
   * @param decoder Instantiated decoder
   *
   * @returns Corresponding API action requestPayload
   */
  registerDecoder (decoder: Decoder): { controller: string, action: string } {
    decoder.action = decoder.action || kebabCase(decoder.sensorModel);

    if (this.api['device-manager/payload'].actions[decoder.action]) {
      throw new PluginImplementationError(`A decoder for "${decoder.sensorModel}" has already been registered.`);
    }

    this.api['device-manager/payload'].actions[decoder.action] = {
      handler: request => this.payloadService.process(request, decoder),
      http: decoder.http,
    };

    this.decoders.set(decoder.sensorModel, decoder);

    return {
      controller: 'device-manager/payload',
      action: decoder.action,
    };
  }

  /**
   * Initialize the administration index of the plugin
   */
  private async initDatabase () {
    const mutex = new Mutex('device-manager/initDatabase');

    await mutex.lock();

    try {
      if (! await this.sdk.index.exists(this.config.adminIndex)) {
        await this.sdk.index.create(this.config.adminIndex);
      }
    }
    finally {
      await mutex.unlock();
    }

    await Promise.all(Object.entries(this.config.adminCollections)
      .map(([collection, mappings]) => (
        this.sdk.collection.create(this.config.adminIndex, collection, { mappings })
      ))
    );
  }

  private mergeCustomMappings () {
    // Merge sensors qos custom mappings
    this.config.collections.sensors.properties.qos.properties = {
      ...this.config.collections.sensors.properties.qos.properties,
      ...this.mappings.sensors.qos,
    };

    // Merge sensors metadata custom mappings
    this.config.collections.sensors.properties.metadata.properties = {
      ...this.config.collections.sensors.properties.metadata.properties,
      ...this.mappings.sensors.metadata,
    };

    // Merge sensors measures custom mappings
    this.config.collections.sensors.properties.measures.properties = {
      ...this.config.collections.sensors.properties.measures.properties,
      ...this.mappings.sensors.measures,
    };

    // Merge assets metadata custom mappings
    this.config.collections.assets.properties.metadata.properties = {
      ...this.config.collections.assets.properties.metadata.properties,
      ...this.mappings.assets.metadata,
    };

    // Use "sensors" mappings to generate "assets" collection mappings
    // for the "measures" property
    const sensorProperties = {
      id: { type: 'keyword' },
      reference: { type: 'keyword' },
      model: { type: 'keyword' },
    };

    for (const [measureType, definition] of Object.entries(this.config.collections.sensors.properties.measures.properties) as any) {
      this.config.collections.assets.properties.measures.properties[measureType] = {
        dynamic: 'false',
        properties: {
          ...sensorProperties,
          ...definition.properties,
          qos: {
            properties: this.config.collections.sensors.properties.qos.properties
          }
        }
      };
    }

    this.config.collections['assets-history'] = this.config.collections.assets;
  }
}

function kebabCase (string) {
  return string
    // get all lowercase letters that are near to uppercase ones
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    // replace all spaces and low dash
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
