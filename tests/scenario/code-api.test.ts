import { InternalCollection } from "../../lib/modules/plugin";
import { setupHooks } from "../helpers";

jest.setTimeout(10000);

describe("Code API", () => {
  const sdk = setupHooks();

  it("can create asset from backend", async () => {
    await sdk.query({
      controller: "tests",
      action: "createDigitalTwinFromBackend",
      engineId: "engine-kuzzle",
      body: { reference: "foobar" },
    });

    const assetExists = await sdk.document.exists(
      "engine-kuzzle",
      InternalCollection.ASSETS,
      "Container-foobar",
    );
    expect(assetExists).toBe(true);

    const deviceExists = await sdk.document.exists(
      "engine-kuzzle",
      InternalCollection.DEVICES,
      "DummyTemp-foobar",
    );
    expect(deviceExists).toBe(true);
  });
});
