import { beforeEachTruncateCollections } from "../../hooks/collections";
import { beforeAllCreateEngines } from "../../hooks/engines";
import { beforeEachLoadFixtures } from "../../hooks/fixtures";

import { useSdk, sendPayloads } from "../../helpers";

jest.setTimeout(10000);

describe("features/Decoder/PayloadController", () => {
  const sdk = useSdk();

  beforeAll(async () => {
    await sdk.connect();
    await beforeAllCreateEngines(sdk);
  });

  beforeEach(async () => {
    await beforeEachTruncateCollections(sdk);
    await beforeEachLoadFixtures(sdk);
  });

  afterAll(async () => {
    sdk.disconnect();
  });

  it("Register a DummyTemp payload", async () => {
    await sendPayloads(sdk, "dummy-temp", [
      { deviceEUI: "12345", temperature: 21 },
      { deviceEUI: "12345", temperature: 42 },
    ]);

    await expect(
      sdk.document.get("device-manager", "devices", "DummyTemp-12345")
    ).resolves.toMatchObject({
      _source: {
        reference: "12345",
        model: "DummyTemp",
        engineId: null,
        assetId: null,
      },
    });
  });

  it("Reject if measuredAt is not unix timestamp", async () => {
    const promise = sendPayloads(sdk, "dummy-temp", [
      { deviceEUI: "12345", temperature: 21, measuredAt: 1671007889 },
    ]);

    await expect(promise).rejects.toMatchObject({
      message:
        'Invalid payload: "measuredAt" should be a timestamp in milliseconds',
    });
  });

  it("Reject with error a DummyTemp payload", async () => {
    const promise = sendPayloads(sdk, "dummy-temp", [
      { deviceEUI: null, temperature: 21 },
    ]);

    await expect(promise).rejects.toMatchObject({
      message: 'Invalid payload: missing "deviceEUI"',
    });
  });

  it("Reject a DummyTemp payload", async () => {
    const response = await sendPayloads(sdk, "dummy-temp", [
      { deviceEUI: "12345", temperature: 21, invalid: true },
    ]);

    expect(response.result).toMatchObject({ valid: false });

    await expect(
      sdk.document.exists("device-manager", "devices", "DummyTemp-12345")
    ).resolves.toBe(false);

    await sdk.collection.refresh("device-manager", "payloads");
    let exceptedResult = await sdk.document.search(
      "device-manager",
      "payloads",
      {
        query: {},
        sort: { "_kuzzle_info.createdAt": "desc" },
      }
    );
    expect(exceptedResult.hits).toHaveLength(1);
    let hit = exceptedResult.hits[0]._source;
    expect(hit.payload).toMatchObject({
      deviceEUI: "12345",
      temperature: 21,
      invalid: true,
    });
    expect(hit.valid).toBeFalsy();
    expect(hit.state).toBe("SKIP");
  });

  it("Reject a DummyTemp payload because of validation error", async () => {
    await expect(
      sendPayloads(sdk, "dummy-temp", [
        {
          temperature: 21,
          location: { lat: 42.2, lon: 2.42, accuracy: 2100 },
          battery: 0.8,
        },
      ])
    ).rejects.toThrow('Invalid payload: missing "deviceEUI"');

    await expect(
      sdk.document.exists("device-manager", "devices", "DummyTemp-12345")
    ).resolves.toBe(false);

    await sdk.collection.refresh("device-manager", "payloads");
    let exceptedResult = await sdk.document.search(
      "device-manager",
      "payloads",
      {
        query: {},
        sort: { "_kuzzle_info.createdAt": "desc" },
      }
    );
    expect(exceptedResult.hits).toHaveLength(1);
    let hit = exceptedResult.hits[0]._source;
    expect(hit.payload).toMatchObject({ temperature: 21 });
    expect(hit.valid).toBeFalsy();
    expect(hit.state).toBe("ERROR");
    expect(hit.reason).toBe('Invalid payload: missing "deviceEUI"');
  });

  it("Receive a payload with 3 measures but only 2 are propagated to the asset", async () => {
    await sendPayloads(sdk, "dummy-temp-position", [
      {
        deviceEUI: "linked2",
        temperature: 21,
        location: { lat: 42.2, lon: 2.42, accuracy: 2100 },
        battery: 0.8,
      },
    ]);

    await expect(
      sdk.document.get("device-manager", "devices", "DummyTempPosition-linked2")
    ).resolves.toMatchObject({
      _source: {
        reference: "linked2",
        model: "DummyTempPosition",
        engineId: "engine-ayse",
        assetId: "Container-linked2",
      },
    });

    await sdk.collection.refresh("engine-ayse", "measures");
    await expect(
      sdk.query({
        _id: "DummyTempPosition-linked2",
        action: "getLastMeasures",
        controller: "device-manager/devices",
        engineId: "engine-ayse",
      })
    ).resolves.toMatchObject({
      result: {
        temperature: { type: "temperature", values: { temperature: 21 } },
        position: {
          type: "position",
          values: { position: { lat: 42.2, lon: 2.42 }, accuracy: 2100 },
        },
        battery: { type: "battery", values: { battery: 80 } },
      },
    });

    await expect(
      sdk.query({
        _id: "Container-linked2",
        action: "getLastMeasures",
        controller: "device-manager/assets",
        engineId: "engine-ayse",
      })
    ).resolves.toMatchObject({
      result: {
        temperatureExt: { values: { temperature: 21 } },
        position: { values: { position: { lat: 42.2, lon: 2.42 } } },
      },
    });

    await sdk.collection.refresh("device-manager", "payloads");
    let exceptedResult = await sdk.document.search(
      "device-manager",
      "payloads",
      {
        query: {},
        sort: { "_kuzzle_info.createdAt": "desc" },
      }
    );
    expect(exceptedResult.hits).toHaveLength(1);
    let hit = exceptedResult.hits[0]._source;
    expect(hit.payload).toMatchObject({
      deviceEUI: "linked2",
      temperature: 21,
      location: { lat: 42.2, lon: 2.42, accuracy: 2100 },
      battery: 0.8,
    });
    expect(hit.valid).toBeTruthy();
    expect(hit.state).toBe("VALID");
  });

  it("Historize the measures with device and asset context", async () => {
    let response = await sendPayloads(sdk, "dummy-temp", [
      { deviceEUI: "linked1", temperature: 42.2 },
    ]);

    await sdk.collection.refresh("engine-ayse", "measures");

    response = await sdk.query({
      controller: "document",
      action: "search",
      index: "engine-ayse",
      collection: "measures",
    });

    expect(response.result.hits[0]).toMatchObject({
      _source: {
        type: "temperature",
        values: { temperature: 42.2 },
        origin: {
          _id: "DummyTemp-linked1",
          measureName: "temperature",
          deviceModel: "DummyTemp",
          reference: "linked1",
        },
        asset: {
          _id: "Container-linked1",
          measureName: "temperatureExt",
          metadata: { weight: 10, height: 11 },
        },
      },
    });
  });

  it("Decode Device metadata from payload", async () => {
    await sendPayloads(sdk, "dummy-temp", [
      { deviceEUI: "12345", temperature: 21.1, metadata: { color: "RED" } },
    ]);

    await expect(
      sdk.document.get("device-manager", "devices", "DummyTemp-12345")
    ).resolves.toMatchObject({
      _source: {
        reference: "12345",
        model: "DummyTemp",
        metadata: { color: "RED" },
      },
    });
  });

  it("Throw an error when decoding unknown measure name", async () => {
    await sdk.query({
      controller: "device-manager/devices",
      action: "create",
      engineId: "device-manager",
      body: { model: "DummyTemp", reference: "test" },
    });

    const promise = sendPayloads(sdk, "dummy-temp", [
      { deviceEUI: "12345", temperature: 21.1, unknownMeasure: 42 },
    ]);

    await expect(promise).rejects.toMatchObject({
      message: 'Decoder "DummyTemp" has no measure named "unknownMeasureName"',
    });
  });

  it("Receive a payload from unknown device", async () => {
    await sdk.query({
      controller: "device-manager/payloads",
      action: "receiveUnknown",
      deviceModel: "Abeeway",
      body: { deviceEUI: "JORA" },
    });

    await sdk.collection.refresh("device-manager", "payloads");

    await expect(
      sdk.document.search(
        "device-manager",
        "payloads",
        {
          query: {},
          sort: { "_kuzzle_info.createdAt": "desc" },
        },
        {
          size: 1,
        }
      )
    ).resolves.toMatchObject({
      hits: {
        "0": {
          _source: {
            deviceModel: "Abeeway",
            valid: false,
            payload: { deviceEUI: "JORA" },
          },
        },
      },
    });
  });
});
