import omit from 'lodash/omit';

import { PluginContext, EmbeddedSDK, Plugin, JSONObject } from 'kuzzle';

import { DeviceManagerConfig } from '../DeviceManagerPlugin';
import { mRequest, mResponse, writeToDatabase } from '../utils/writeMany';
import { BaseAsset } from '../models/BaseAsset';
import { AssetContentBase } from '../types';

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

    const assetDocuments = assets.map((asset: AssetContentBase) => {
      const _asset = new BaseAsset(asset);
      
      return {
        _id: _asset._id,
        body: omit(asset, ['_id']),
      }
    })

    await writeToDatabase(
      assetDocuments,
      async (result: mRequest[]): Promise<mResponse> => {

        const created = await this.sdk.document.mCreate(
          index,
          'assets',
          result,
          { strict, ...options }
        );

        return {
          successes: results.successes.concat(created.successes),
          errors: results.errors.concat(created.errors),
        };
      }
    );

    return results;
  }
}