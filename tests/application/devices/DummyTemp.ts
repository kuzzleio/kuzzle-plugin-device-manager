import { DeviceModel } from "../../../index";
import { DummyTempDecoder } from "../decoders/DummyTempDecoder";

export const DummyTemp: DeviceModel = {
  modelName: "DummyTemp",
  definition: {
    decoder: new DummyTempDecoder(),
    metadataMappings: {
      color: { type: "keyword" },
    },
  },
};
