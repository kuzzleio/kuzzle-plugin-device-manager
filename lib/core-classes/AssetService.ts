import omit from 'lodash/omit';
import { v4 as uuidv4 } from 'uuid';

import { PluginContext, EmbeddedSDK, Plugin, JSONObject } from 'kuzzle';

import { DeviceManagerConfig } from '../DeviceManagerPlugin';
import { mRequest, writeToDatabase } from '../utils/writeMany';

export class AssetService {
  private config: DeviceManagerConfig;
  private context: PluginContext;

  get sdk(): EmbeddedSDK {
    return this.context.accessors.sdk;
  }

  constructor(plugin: Plugin) {
    this.config = plugin.config as any;
    this.context = plugin.context;
  }

  async importAssets(
    index: string,
    assets: JSONObject,
    { strict, options }: { strict?: boolean; options?: JSONObject }
  ) {
    const results = {
      errors: [],
      successes: [],
    };

    const assetDocuments = assets.map((device: JSONObject) => ({
      _id: device._id || uuidv4(),
      body: omit(device, ['_id']),
    }));

    await writeToDatabase(
      assetDocuments,
      async (result: mRequest[]): Promise<JSONObject> => {
        console.log(result);

        const created = await this.sdk.document.mCreate(
          index,
          'assets',
          result,
          { strict, ...options }
        );

        return {
          success: results.successes.push(...created.successes),
          errors: results.errors.push(...created.errors),
        };
      }
    );

    return results;
  }
}