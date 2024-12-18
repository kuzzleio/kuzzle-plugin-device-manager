import { AssetModel } from "../../../index";

export const Room: AssetModel = {
  modelName: "Room",
  definition: {
    measures: [
      {
        name: "temperature",
        type: "temperature",
      },
      {
        name: "humidity",
        type: "humidity",
      },
      {
        name: "co2",
        type: "co2",
      },
      {
        name: "illuminance",
        type: "illuminance",
      },
    ],
    metadataMappings: {
      floor: { type: "integer" },
      width: { type: "integer" },
    },
  },
};
