import { MeasureModel } from "../../../index";

export const Brightness: MeasureModel = {
  modelName: "brightness",
  definition: {
    valuesMappings: { lumens: { type: "float" } },
  },
};
