import { JSONObject } from 'kuzzle';

import { CatalogContent } from './Catalog';

/**
 * Represents either a Rule or Workflow raw configuration document
 */
export type ConfigContent = ConfigCatalogContent | JSONObject;

/**
 * Content of a configuration document for a catalog entry
 */
export type ConfigCatalogContent = {
  type: 'catalog';

  catalog: CatalogContent;

  _kuzzle_info?: JSONObject;
}

/**
 * Class to manipulate configuration documents
 */
export class ConfigDocument<TConfigContent> {
  _id: string;
  _source: ConfigContent;

  /**
   * Rule or workflow definition
   */
  get content (): TConfigContent {
    return this._source[this._source.type];
  }

  /**
   * Author or updater of the document (from Kuzzle Metadata)
   */
  get author (): string {
    return this._source._kuzzle_info.updater || this._source._kuzzle_info.author;
  }

  constructor (document: { _id?: string, _source: JSONObject }) {
    this._id = document._id;
    this._source = document._source as ConfigContent;
  }
}