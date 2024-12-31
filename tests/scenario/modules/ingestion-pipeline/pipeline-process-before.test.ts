import { DeviceContent } from "lib/modules/device";
import { ContainerAssetContent } from "../../../application/assets/Container";

import {
  sendDummyTempPayloads,
  sendDummyTempPositionPayloads,
  setupHooks,
} from "../../../helpers";

jest.setTimeout(10000);

describe("Ingestion Pipeline: process before", () => {
  const sdk = setupHooks();

  it("allows to add a new measure only to the asset", async () => {
    await sendDummyTempPayloads(sdk, [
      {
        deviceEUI: "linked1",
        temperature: 21,
        metadata: {
          // search this string to find the associated pipe
          color: "test-create-new-asset-measure",
        },
      },
    ]);

    const asset = await sdk.document.get<ContainerAssetContent>(
      "engine-ayse",
      "assets",
      "Container-linked1",
    );
    expect(asset._source.measures).toMatchObject({
      temperatureExt: {
        values: {
          temperature: 21,
        },
      },
      temperatureWeather: {
        values: {
          temperature: 21.21,
        },
      },
    });
  });

  it("should update lastReceive for new measures", async () => {
    const now = Date.now();
    await sendDummyTempPositionPayloads(sdk, [
      {
        deviceEUI: "linked2",
        temperature: {
          value: 21,
          measuredAt: 1680096420000, // 13:27:00 UTC
        },
        location: {
          value: {
            lat: 21,
            lon: 21,
          },
          measuredAt: 1680096300000, // 13:25:00 UTC
        },
      },
    ]);

    const device = await sdk.document.get<DeviceContent>(
      "engine-ayse",
      "devices",
      "DummyTempPosition-linked2",
    );

    expect(device._source.lastMeasuredAt).toBeGreaterThanOrEqual(now);

    const asset = await sdk.document.get<ContainerAssetContent>(
      "engine-ayse",
      "assets",
      "Container-linked2",
    );

    expect(asset._source.lastMeasuredAt).toBe(1680096420000);
  });

  it("should not update lastMeasuredAt if measures are older than current lastMeasure", async () => {
    const now = Date.now();
    await sendDummyTempPositionPayloads(sdk, [
      {
        deviceEUI: "linked2",
        temperature: {
          value: 21,
          measuredAt: now,
        },
        location: {
          value: {
            lat: 21,
            lon: 21,
          },
          measuredAt: now,
        },
      },
    ]);

    let device = await sdk.document.get<DeviceContent>(
      "engine-ayse",
      "devices",
      "DummyTempPosition-linked2",
    );
    expect(device._source.lastMeasuredAt).toBeGreaterThanOrEqual(now);
    let asset = await sdk.document.get<ContainerAssetContent>(
      "engine-ayse",
      "assets",
      "Container-linked2",
    );
    expect(asset._source.lastMeasuredAt).toBeGreaterThanOrEqual(now);

    await sendDummyTempPositionPayloads(sdk, [
      {
        deviceEUI: "linked2",
        temperature: {
          value: 21,
          measuredAt: now - 100000,
        },
        location: {
          value: {
            lat: 21,
            lon: 21,
          },
          measuredAt: now - 100000,
        },
      },
    ]);
    device = await sdk.document.get<DeviceContent>(
      "engine-ayse",
      "devices",
      "DummyTempPosition-linked2",
    );

    expect(device._source.lastMeasuredAt).toBeGreaterThanOrEqual(now);

    asset = await sdk.document.get<ContainerAssetContent>(
      "engine-ayse",
      "assets",
      "Container-linked2",
    );

    expect(asset._source.lastMeasuredAt).toBeGreaterThanOrEqual(now);
  });
});
