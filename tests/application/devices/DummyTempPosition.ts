import { DeviceModel } from "../../../index";
import { DummyTempPositionDecoder } from "../decoders/DummyTempPositionDecoder";

export const DummyTempPosition: DeviceModel = {
  modelName: "DummyTempPosition",
  definition: {
    decoder: new DummyTempPositionDecoder(),
    metadataMappings: {
      serial: { type: "keyword" },
    },
  },
};
