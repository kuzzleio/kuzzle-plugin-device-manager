import { JSONObject } from 'kuzzle';

import { BaseAssetContent } from '../types';
export class BaseAsset {
  _id: string;
  _source: BaseAssetContent;

  constructor (content: BaseAssetContent, _id?: string) {
    this._id = _id || `${content.type}-${content.model}-${content.reference}`;

    this._source = content;
  }

  serialize (): JSONObject {
    return {
      _id: this._id,
      _source: this._source
    };
  }
}

export const assetsMappings = {
  dynamic: 'strict',
  properties: {
    type: {
      type: 'keyword',
      fields: {
        text: { type: 'text' }
      }
    },
    model: {
      type: 'keyword',
      fields: {
        text: { type: 'text' }
      }
    },
    reference: {
      type: 'keyword',
      fields: {
        text: { type: 'text' }
      }
    },
    measures: {
      properties: {
        // autogenerated from devices mappings
      }
    },
    metadata: {
      dynamic: 'false',
      properties: {}
    }
  }
};
