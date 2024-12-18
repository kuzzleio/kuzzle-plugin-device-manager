import { JSONObject } from "kuzzle-sdk";
import { useSdk } from "../helpers";
import { beforeAllCreateEngines } from "../hooks/engines";

describe("Assets mapping", () => {
  const sdk = useSdk();

  beforeAll(async () => {
    await sdk.connect();

    await beforeAllCreateEngines(sdk);
  });

  afterAll(async () => {
    sdk.disconnect();
  });

  it("asset mapping can be customize by application", async () => {
    const mapping: JSONObject = await sdk.collection.getMapping(
      "engine-ayse",
      "assets",
    );

    expect(mapping.properties?.custom).toBeDefined();
    expect(mapping.properties.custom).toMatchObject({
      type: "keyword",
      fields: { text: { type: "text" } },
    });
  });

  it("device mapping can be customize by application", async () => {
    const mapping: JSONObject = await sdk.collection.getMapping(
      "engine-ayse",
      "devices",
    );

    expect(mapping.properties?.custom).toBeDefined();
    expect(mapping.properties.custom).toMatchObject({
      type: "keyword",
      fields: { text: { type: "text" } },
    });
  });
});
