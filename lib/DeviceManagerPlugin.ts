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
import { EngineService, PayloadService, SensorService, DecoderService } from './services';
import { Decoder } from './decoders';
import { sensorsMappings, assetsMappings } from './models';

export class DeviceManagerPlugin extends Plugin {
  private defaultConfig: JSONObject;

  private assetController: AssetController;
  private sensorController: SensorController;
  private engineController: EngineController;

  private payloadService: PayloadService;
  private engineService: EngineService;
  private sensorService: SensorService;
  private decoderService: DecoderService;

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
   * Constructor
   */
  constructor() {
    super({
      kuzzleVersion: '>=2.10.0 <3'
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
      'multi-tenancy/tenant:afterCreate': async request => {
        const { index: tenantIndex } = request.result;

        const { collections } = await this.engineService.create(tenantIndex);

        if (!Array.isArray(request.result.collections)) {
          request.result.collections = [];
        }
        request.result.collections.push(...collections);

        return request;
      },
      'multi-tenancy/tenant:afterDelete': async request => {
        const { index: tenantIndex } = request.result;

        await this.engineService.delete(tenantIndex);

        return request;
      }
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
        payloads: {
          dynamic: 'false',
          // @todo have API action to clean
          properties: {
            uuid: { type: 'keyword' },
            valid: { type: 'boolean' },
            sensorModel: { type: 'keyword' },
            payload: {
              properties: {}
            }
          }
        }
      },
      collections: {
        assets: assetsMappings,
        sensors: sensorsMappings,
      }
    };
    this.decoderService = new DecoderService(this.config);
  }

  /**
   * Init the plugin
   */
  async init (config: JSONObject, context: PluginContext) {
    this.config = { ...this.defaultConfig, ...config };
    this.context = context;

    this.mergeCustomMappings();

    this.engineService = new EngineService(this.config, context);
    this.payloadService = new PayloadService(this.config, context);
    this.sensorService = new SensorService(this.config, context, this.decoderService);

    this.assetController = new AssetController(this.config, context);
    this.engineController = new EngineController(this.config, context, this.engineService);
    this.sensorController = new SensorController(this.config, context, this.sensorService);

    this.api['device-manager/asset'] = this.assetController.definition;
    this.api['device-manager/sensor'] = this.sensorController.definition;
    this.api['device-manager/engine'] = this.engineController.definition;

    await this.initDatabase();

    for (const decoder of this.decoderService.values) {
      this.context.log.info(`Register API action "device-manager/payload:${decoder.action}" with decoder "${decoder.constructor.name}" for sensor "${decoder.sensorModel}"`);
    }
  }

  /**
   * Registers a new decoder for a sensor model.
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

    this.decoderService.add(decoder.sensorModel, decoder);

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

    // Merge custom mappings from decoders for payloads collection
    for (const decoder of this.decoderService.values) {
      this.config.adminCollections.payloads.properties.payload.properties = {
        ...this.config.adminCollections.payloads.properties.payload.properties,
        ...decoder.payloadsMappings,
      };
    }
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
