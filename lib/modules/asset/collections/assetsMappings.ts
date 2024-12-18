import { CollectionMappings } from "kuzzle";

/**
 * Base mappings for the "assets" collection.
 *
 * Those mappings does not contains the `measures` and `metadata` mappings.
 */
export const assetsMappings: CollectionMappings = {
  dynamic: "strict",
  properties: {
    model: {
      type: "keyword",
      fields: { text: { type: "text" } },
    },
    reference: {
      type: "keyword",
      fields: { text: { type: "text" } },
    },
    groups: {
      properties: {
        id: {
          type: "keyword",
          fields: { text: { type: "text" } },
        },
        date: { type: "date" },
      },
    },
    softTenant: {
      type: "keyword",
      fields: { text: { type: "text" } },
    },
    metadata: {
      properties: {
        // populated with asset models
      },
    },

    measures: {
      properties: {
        // populated with asset models
      },
    },

    lastMeasuredAt: { type: "date" },

    linkedDevices: {
      properties: {
        _id: { type: "keyword" },
        measureNames: {
          properties: {
            asset: { type: "keyword" },
            device: { type: "keyword" },
            type: { type: "keyword" },
          },
        },
      },
    },
  },
};
