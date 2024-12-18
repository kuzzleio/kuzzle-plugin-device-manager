import { assetGroupFixtures } from "./assetsGroups";
import { ayseAssets } from "./assets";
import { ayseDevices, internalDevices } from "./devices";

export default {
  "device-manager": {
    devices: internalDevices,
  },

  // Index "engine-ayse"
  "engine-ayse": {
    devices: ayseDevices,
    assets: ayseAssets,
    ...assetGroupFixtures,
  },
};
