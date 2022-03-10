import { ControllerDefinition, PluginContext } from 'kuzzle';

import { DeviceManagerPlugin } from '../DeviceManagerPlugin';
import { DecodersRegister } from '../core-classes';
import { DeviceManagerConfiguration } from '../types';

export class DecodersController {
  private context: PluginContext;
  private config: DeviceManagerConfiguration;
  private decodersRegister: DecodersRegister;

  public definition: ControllerDefinition;

  constructor (plugin: DeviceManagerPlugin, decodersRegister: DecodersRegister) {
    this.context = plugin.context;
    this.config = plugin.config;
    this.decodersRegister = decodersRegister;

    this.definition = {
      actions: {
        list: {
          handler: this.list.bind(this),
          http: [{ path: 'device-manager/decoders', verb: 'get' }],
        }
      }
    };
  }

  /**
   * List all available decoders
   */
  async list () {
    const decoders = await this.decodersRegister.list();

    return { decoders };
  }
}