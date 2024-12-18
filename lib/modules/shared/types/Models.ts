import { MeasureDefinition } from "../../measure";
import { AssetModelDefinition, DeviceModelDefinition } from "../../model";

interface ModelDefinition<Definition> {
  /**
   * Name of model
   */
  modelName: string;
  /**
   * Model definition used by the plugin to create associated ressources
   * and updates mappings.
   */
  definition: Definition;
}
export type AssetModel = ModelDefinition<AssetModelDefinition>;
export type DeviceModel = ModelDefinition<DeviceModelDefinition>;
export type MeasureModel = ModelDefinition<MeasureDefinition>;
