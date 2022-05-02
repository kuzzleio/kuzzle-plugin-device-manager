import { JSONObject } from 'kuzzle';

export type DeviceManagerConfiguration = {
  /**
   * Administration index name
   */
  adminIndex: string;

  /**
   * Administration collections mappings (in admin index)
   */
  adminCollections: {
    config: {
      name: string,
      mappings: JSONObject,
      settings: JSONObject,
    };

    devices: {
      name: string,
      mappings: JSONObject,
      settings: JSONObject,
    };

    payloads: {
      name: string,
      mappings: JSONObject,
      settings: JSONObject,
    };
  },

  engineCollections: {
    config: {
      name: string,
      mappings: JSONObject,
      settings: JSONObject,
    };
  },

  /**
   * Interval to write documents from the buffer
   *
   * @see https://docs.kuzzle.io/sdk/js/7/essentials/batch-processing/
   */
  batchInterval: number;
}