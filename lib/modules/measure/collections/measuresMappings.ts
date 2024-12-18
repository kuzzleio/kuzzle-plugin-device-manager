/**
 * Base mappings for the "measures" collection.
 *
 * Those mappings does not contains the `values` mappings and `asset.metadata` mappings.
 */
export const measuresMappings = {
  dynamic: "strict",
  properties: {
    type: { type: "keyword" },

    values: {
      properties: {
        // populated with measure models mappings
      },
    },

    /**
     * Micro Timestamp of the measurement time.
     */
    measuredAt: { type: "date" },

    asset: {
      properties: {
        _id: { type: "keyword" },
        model: { type: "keyword" },
        reference: { type: "keyword" },
        measureName: { type: "keyword" },
        metadata: {
          properties: {
            // populated with asset models metadata mappings
          },
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
      },
    },

    /**
     * Define the origin of the measure.
     */
    origin: {
      properties: {
        type: { type: "keyword" },

        measureName: { type: "keyword" },

        deviceMetadata: {
          properties: {
            // populated with device models metadata mappings
          },
        },

        apiMetadata: {
          dynamic: "false",
          properties: {},
        },

        payloadUuids: { type: "keyword" },

        deviceModel: { type: "keyword" },

        reference: { type: "keyword" },

        _id: { type: "keyword" },
      },
    },
  },
};
