import { AssetModel } from "../../../index";

export const StreetLamp: AssetModel = {
  modelName: "StreetLamp",
  definition: {
    measures: [
      {
        name: "brightness",
        type: "brightness",
      },
      {
        name: "powerConsumption",
        type: "powerConsumption",
      },
    ],
    metadataMappings: {
      position: { type: "geo_point" },
      street: { type: "keyword" },
    },
  },
};
