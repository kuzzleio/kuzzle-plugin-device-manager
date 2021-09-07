import _ from 'lodash';
import { JSONObject, PluginImplementationError } from 'kuzzle';
import { BaseMeasure } from 'lib/types';

export class DeviceMappingsManager {
  private mappings: JSONObject;

  constructor (baseMappings: JSONObject) {
    this.mappings = JSON.parse(JSON.stringify(baseMappings));
  }

  /**
   * Register custom metadata for devices
   *
   * @param metadata Device custom metadata
   */
  registerMetadata (metadata) {
    for (const [name, value] of Object.entries(metadata)) {
      this.mappings.properties.metadata.properties[name] = value;
    }
  }

  /**
   * Register custom QoS for devices
   *
   * @param qos Device custom QoS
   */
  registerQoS (qos: JSONObject) {
    for (const [name, value] of Object.entries(qos)) {
      this.mappings.properties.qos.properties[name] = value;
    }
  }

  /**
   * Register custom measure for devices
   *
   * @param qos Device custom measure
   */
  registerMeasure (name: string, measure: JSONObject) {
    if (this.mappings.properties.measures.properties[name]) {
      throw new PluginImplementationError(`Measure "${name}" already exists.`);
    }

    const newMeasure = {
      ...measure,
      payloadUuid: { type: 'keyword' },
      updatedAt: { type: 'date' },
    }

    this.mappings.properties.measures.properties[name] = {
      properties: newMeasure
    };
  }

  get (): JSONObject {
    return this.mappings;
  }
}
