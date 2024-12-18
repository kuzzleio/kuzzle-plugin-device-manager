import { AssetModel } from "../../../index";

export const Warehouse: AssetModel = {
  modelName: "Warehouse",
  definition: {
    measures: [{ name: "position", type: "position" }],
    metadataMappings: {
      surface: { type: "integer" },
    },
  },
};
