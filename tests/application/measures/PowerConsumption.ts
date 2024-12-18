import { MeasureModel } from "../../../index";

export const PowerConsumption: MeasureModel = {
  modelName: "powerConsumption",
  definition: {
    valuesMappings: { watt: { type: "float" } },
  },
};
