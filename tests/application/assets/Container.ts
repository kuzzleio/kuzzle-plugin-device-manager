import {
  Metadata,
  AssetContent,
  TemperatureMeasurement,
  PositionMeasurement,
  AssetModel,
} from "../../../index";

const modelName = "Container";

export interface ContainerMetadata extends Metadata {
  height: number;
  width: number;
  trailer: {
    weight: number;
    capacity: number;
  };
  person: {
    company: string;
  };
}

export type ContainerMeasurements = {
  temperatureExt: TemperatureMeasurement;
  temperatureInt: TemperatureMeasurement;
  position: PositionMeasurement;
  temperatureWeather: TemperatureMeasurement;
};

export interface ContainerAssetContent extends AssetContent<ContainerMeasurements, ContainerMetadata> {
  model: typeof modelName;
}

export const Container: AssetModel = {
  modelName,
  definition: {
    measures: [
      { name: "temperatureExt", type: "temperature" },
      { name: "temperatureInt", type: "temperature" },
      { name: "position", type: "position" },
      { name: "temperatureWeather", type: "temperature" },
    ],
    metadataMappings: {
      weight: { type: "integer" },
      height: { type: "integer" },
      trailer: {
        properties: {
          weight: { type: "integer" },
          capacity: { type: "integer" },
        },
      },
      person: {
        properties: {
          company: { type: "keyword" },
        },
      },
    },
    defaultMetadata: {
      height: 20,
    },
    metadataDetails: {
      extTemp: {
        group: "environment",
        locales: {
          en: {
            friendlyName: "External Temperature",
            description: "The temperature outside the container",
          },
          fr: {
            friendlyName: "Température Externe",
            description: "La température à l'extérieur du conteneur",
          },
        },
      },
      intTemp: {
        group: "environment",
        locales: {
          en: {
            friendlyName: "Internal Temperature",
            description: "The temperature inside the container",
          },
          fr: {
            friendlyName: "Température Interne",
            description: "La température à l'intérieur du conteneur",
          },
        },
      },
    },
    metadataGroups: {
      environment: {
        locales: {
          en: {
            groupFriendlyName: "Environmental Measurements",
            description: "All environmental relative measurments",
          },
          fr: {
            groupFriendlyName: "Mesures environnementales",
            description: "Toutes les mesures liées a l'environement",
          },
        },
      },
    },
    tooltipModels: {
      defaultTooltipKey: {
        tooltipLabel: "Default Tooltip Model",
        content: [
          {
            category: "measure",
            label: {
              locales: {
                en: {
                  friendlyName: "External Temperature",
                  description: "",
                },
                fr: {
                  friendlyName: "Température Externe",
                  description: "",
                },
              },
            },
            measureSlot: "temperatureExt",
            measureValuePath: "temperatureExt",
          },
          {
            category: "measure",
            label: {
              locales: {
                en: {
                  friendlyName: "Internal Temperature",
                  description: "",
                },
                fr: {
                  friendlyName: "Température Interne",
                  description: "",
                },
              },
            },
            measureSlot: "temperatureInt",
            measureValuePath: "temperatureInt",
          },
        ],
      },
    },
  },
};

// Mocked data example to match the expected type structure
const temperatureMeasureExample = {
  payloadUuids: ["uuid1", "uuid2"],
  type: "temperature",
  measuredAt: new Date().getTime(),
  name: "temperatureExt",
  originId: "someOriginId",
  values: {
    temperature: 20,
  },
};

const positionMeasureExample = {
  payloadUuids: ["uuid3", "uuid4"],
  type: "position",
  measuredAt: new Date().getTime(),
  name: "position",
  originId: "someOriginId",
  values: {
    position: {
      lat: 0,
      lon: 0,
    },
    accuracy: 10,
  },
};

const measures = {
  temperatureExt: temperatureMeasureExample,
  temperatureInt: { ...temperatureMeasureExample, name: "temperatureInt", values: { temperature: 22 } },
  position: positionMeasureExample,
  temperatureWeather: { ...temperatureMeasureExample, name: "temperatureWeather", values: { temperature: 15 } },
};

// This function is never called and only exists to make sure the types are correct
function neverCalled() {
  const container: ContainerAssetContent = {
    model: "Container",
    linkedDevices: [],
    groups: [],
    reference: "",
    metadata: undefined,
    measures,
    lastMeasuredAt: 0,
    softTenant: [],
  };

  container.metadata.height = 40;
  if (container.measures.temperatureExt) {
    container.measures.temperatureExt.values.temperature = 20;
  }
  if (container.measures.position) {
    container.measures.position.values.accuracy = 10;
  }
  // @ts-expect-error
  container.measures.unexistingMeasure;
  // @ts-expect-error
  container.measures.temperatureExt.values.notValue;
}
