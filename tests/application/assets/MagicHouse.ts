import { AssetModel } from "../../../index";

export const MagicHouse: AssetModel = {
  modelName: "MagicHouse",
  definition: {
    measures: [
      { name: "magiculeExt", type: "magicule" },
      { name: "magiculeInt", type: "magicule" },
    ],
    metadataMappings: {
      power: { type: "integer" },
    },
  },
};
