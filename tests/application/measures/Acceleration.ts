import { MeasureModel } from "../../../index";

/* eslint-disable sort-keys */

export type AccelerationMeasurement = {
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  accuracy: number;
};

export const Acceleration: MeasureModel = {
  modelName: "acceleration",
  definition: {
    valuesMappings: {
      acceleration: {
        properties: {
          x: { type: "float" },
          y: { type: "float" },
          z: { type: "float" },
        },
      },
      accuracy: { type: "float" },
    },
  },
};
