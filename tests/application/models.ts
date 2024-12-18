import { DeviceManagerPlugin } from "../../index";
import { Container, Warehouse, MagicHouse, Room, StreetLamp } from "./assets";
import { DummyTemp, DummyTempPosition } from "./devices";
import {
  Acceleration,
  Brightness,
  CO2,
  Illuminance,
  Magicule,
  PowerConsumption,
} from "./measures";

const measuresModels = [
  Acceleration,
  Brightness,
  CO2,
  Illuminance,
  Magicule,
  PowerConsumption,
];

const devicesModels = [DummyTemp, DummyTempPosition];

const assetsModels = {
  // Register assets for the "commons" group
  commons: [Container, Warehouse, MagicHouse],

  // Register assets for specialized groups
  air_quality: [Room],
  public_lighting: [StreetLamp],
};

export function registerModels(deviceManager: DeviceManagerPlugin) {
  for (const model of measuresModels) {
    deviceManager.models.registerMeasure(model.modelName, model.definition);
  }

  for (const model of devicesModels) {
    deviceManager.models.registerDevice(model.modelName, model.definition);
  }

  for (const [engine, models] of Object.entries(assetsModels)) {
    for (const model of models) {
      deviceManager.models.registerAsset(
        engine,
        model.modelName,
        model.definition,
      );
    }
  }
}
