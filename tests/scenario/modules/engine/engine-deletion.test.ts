import { beforeAllCreateEngines } from "../../../hooks/engines";
import { beforeEachLoadFixtures } from "../../../hooks/fixtures";

import { useSdk } from "../../../helpers";

jest.setTimeout(10000);

describe("Engine deletion", () => {
  const sdk = useSdk();

  beforeAll(async () => {
    await sdk.connect();
    await beforeAllCreateEngines(sdk);
  });

  beforeEach(async () => {
    await beforeAllCreateEngines(sdk);
    await beforeEachLoadFixtures(sdk);
  });

  afterAll(async () => {
    sdk.disconnect();
  });
  const adminIndex = "device-manager";
  const engineId = "engine-ayse";

  it("Deletes the engine from admin index", async () => {
    const engine = await sdk.document.get(
      adminIndex,
      "config",
      `engine-device-manager--${engineId}`,
    );

    expect(engine).toBeTruthy();

    await sdk.query({
      controller: "device-manager/engine",
      action: "delete",
      index: engineId,
    });

    const promise = sdk.document.get(
      adminIndex,
      "config",
      `engine-device-manager--${engineId}`,
    );

    await expect(promise).rejects.toThrow();
  });
  it("Detach devices from engine in the admin index on engine deletion", async () => {
    const devices = await sdk.document.search(adminIndex, "devices", {
      _source: false,
      query: { bool: { must: { term: { engineId } } } },
    });
    expect(devices.total).toBeGreaterThan(0);

    await sdk.query({
      controller: "device-manager/engine",
      action: "delete",
      index: engineId,
    });

    const result = await sdk.document.search(adminIndex, "devices", {
      _source: false,
      query: { bool: { must: { term: { engineId } } } },
    });
    expect(result.total).toBe(0);
  });
});
