import { Module } from "../shared/Module";

import { AssetHistoryService } from "./AssetHistoryService";
import { AssetsController } from "./AssetsController";
import { AssetService } from "./AssetService";
import { RoleAssetsAdmin } from "./roles/RoleAssetsAdmin";
import { RoleAssetsReader } from "./roles/RoleAssetsReader";

export class AssetModule extends Module {
  private assetService: AssetService;
  private assetHistoryService: AssetHistoryService;
  private assetController: AssetsController;

  public async init(): Promise<void> {
    this.assetHistoryService = new AssetHistoryService(this.plugin);
    this.assetService = new AssetService(this.plugin, this.assetHistoryService);
    this.assetController = new AssetsController(this.assetService);

    this.plugin.api["device-manager/assets"] = this.assetController.definition;

    this.plugin.imports.roles[RoleAssetsAdmin.name] = RoleAssetsAdmin.definition;
    this.plugin.imports.roles[RoleAssetsReader.name] = RoleAssetsReader.definition;
  }
}
