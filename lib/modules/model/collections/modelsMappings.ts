import { CollectionMappings } from "kuzzle";

/* eslint-disable sort-keys */

/**
 * Mappings for models configuration documents
 */
export const modelsMappings: CollectionMappings = {
  dynamic: "strict",
  properties: {
    type: { type: "keyword" },
    engineGroup: { type: "keyword" },

    /**
     * Measure model
     */
    measure: {
      properties: {
        type: { type: "keyword" },
        valuesMappings: {
          dynamic: "false",
          properties: {},
        },
        validationSchema: {
          dynamic: "false",
          properties: {},
        },
        valuesDetails: {
          dynamic: "false",
          properties: {},
        },
        locales: {
          dynamic: "false",
          properties: {},
        },
      },
    },

    /**
     * Asset model
     */
    asset: {
      properties: {
        model: { type: "keyword" },
        metadataMappings: {
          dynamic: "false",
          properties: {},
        },
        defaultMetadata: {
          dynamic: "false",
          properties: {},
        },
        metadataDetails: {
          dynamic: "false",
          properties: {},
        },
        metadataGroups: {
          dynamic: "false",
          properties: {},
        },
        measures: {
          properties: {
            type: { type: "keyword" },
            name: { type: "keyword" },
          },
        },
        tooltipModels: {
          dynamic: "false",
          properties: {},
        },
      },
    },

    /**
     * Device model
     */
    device: {
      properties: {
        model: { type: "keyword" },
        metadataMappings: {
          dynamic: "false",
          properties: {},
        },
        defaultMetadata: {
          dynamic: "false",
          properties: {},
        },
        metadataDetails: {
          dynamic: "false",
          properties: {},
        },
        metadataGroups: {
          dynamic: "false",
          properties: {},
        },
        measures: {
          properties: {
            type: { type: "keyword" },
            name: { type: "keyword" },
          },
        },
      },
    },
  },
};
