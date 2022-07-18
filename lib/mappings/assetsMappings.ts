export const assetsMappings = {
  dynamic: 'strict',
  properties: {
    category: {
      fields: {
        text: { type: 'text' }
      },
      type: 'keyword'
    },
    deviceLinks: {
      properties: {
        deviceId: {
          fields: {
            text: { type: 'text' }
          },
          type: 'keyword'
        },
        measuresName: {
          properties: {
            name: {
              fields: {
                text: { type: 'text' }
              },
              type: 'keyword'
            },
            type: {
              fields: {
                text: { type: 'text' }
              },
              type: 'keyword'
            },
          }
        }
      }
    },
    measures: {
      properties: {
        // autogenerated from devices mappings
      }
    },
    metadata: {
      dynamic: 'strict',
      properties: {
        key: { type: 'keyword' },
        value: {
          properties: {
            boolean: { type: 'boolean' },
            integer: { type: 'integer' },
            keyword: { type: 'keyword' },
          }
        }
      }
    },
    model: {
      fields: {
        text: { type: 'text' }
      },
      type: 'keyword'
    },
    reference: {
      fields: {
        text: { type: 'text' }
      },
      type: 'keyword'
    },
    subCategory: {
      fields: {
        text: { type: 'text' }
      },
      type: 'keyword'
    },
    type: {
      fields: {
        text: { type: 'text' }
      },
      type: 'keyword'
    }
  }
};
