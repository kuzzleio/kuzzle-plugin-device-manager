import {
  ApiAssetCreateRequest,
  ApiAssetCreateResult,
  ApiAssetDeleteRequest,
  ApiAssetGetRequest,
  ApiAssetGetResult,
  ApiAssetSearchRequest,
  ApiAssetSearchResult,
  ApiAssetUpdateRequest,
  ApiAssetUpdateResult,
  ApiAssetUpsertRequest,
  ApiAssetUpsertResult,
} from "../../../../index";
import { InternalCollection } from "../../../../lib/modules/plugin";
import {
  assetAyseLinked1,
  assetAyseLinked1Id,
  assetAyseLinked2,
  assetAyseLinked2Id,
  assetAyseUnlinked,
  assetAyseUnlinkedId,
  deviceAyseLinked1Id,
} from "../../../fixtures";
import { setupHooks } from "../../../helpers";

jest.setTimeout(10000);

type PartialBody = Omit<ApiAssetCreateRequest, "body"> & {
  body: Partial<ApiAssetCreateRequest["body"]>;
};

describe("AssetsController:SCRUD", () => {
  const sdk = setupHooks();

  it("can create asset", async () => {
    const baseQuery = {
      controller: "device-manager/assets",
      engineId: "engine-ayse",
      action: "create",
    } satisfies Partial<ApiAssetCreateRequest>;

    const missingBodyQuery: Omit<ApiAssetCreateRequest, "body"> = baseQuery;
    await expect(sdk.query(missingBodyQuery)).rejects.toThrow(
      /^The request must specify a body.$/,
    );

    const missingModelQuery: PartialBody = {
      ...baseQuery,
      body: {
        reference: "A1",
        metadata: { height: 5 },
      },
    };
    await expect(sdk.query(missingModelQuery)).rejects.toThrow(
      /^Missing argument "body.model".$/,
    );

    const missingReferenceQuery: PartialBody = {
      ...baseQuery,
      body: {
        model: "Container",
        metadata: { height: 5 },
      },
    };
    await expect(sdk.query(missingReferenceQuery)).rejects.toThrow(
      /^Missing argument "body.reference".$/,
    );

    const unknownModel: PartialBody = {
      ...baseQuery,
      body: {
        model: "truck",
        reference: "BX98HZ",
      },
    };
    await expect(sdk.query(unknownModel)).rejects.toThrow(
      /^Unknown Asset model "truck".$/,
    );

    const withoutMetadata = await sdk.query<
      ApiAssetCreateRequest,
      ApiAssetCreateResult
    >({
      ...baseQuery,
      body: {
        model: "Container",
        reference: "A1",
      },
    });
    expect(withoutMetadata.status).toBe(200);
    expect(withoutMetadata.result._id).toBe("Container-A1");
    expect(withoutMetadata.result._source).toMatchObject({
      groups: [],
      lastMeasuredAt: null,
      linkedDevices: [],
      model: "Container",
      reference: "A1",
      softTenant: [],
    });
    expect(withoutMetadata.result._source.measures).toMatchObject({
      position: null,
      temperatureExt: null,
      temperatureInt: null,
      temperatureWeather: null,
    });
    expect(withoutMetadata.result._source.metadata).toMatchObject({
      height: 20,
      person: null,
      trailer: null,
      weight: null,
    });

    const { result: withMetadata } = await sdk.query<
      ApiAssetCreateRequest,
      ApiAssetCreateResult
    >({
      controller: "device-manager/assets",
      action: "create",
      engineId: "engine-kuzzle",
      body: {
        model: "Container",
        reference: "A2",
        metadata: {
          height: 5,
          person: {
            company: "ACME",
          },
          weight: 10,
        },
      },
    });
    expect(withMetadata._source.metadata).toMatchObject({
      height: 5,
      person: {
        company: "ACME",
      },
      trailer: null,
      weight: 10,
    });

    const assetDocument = await sdk.document.get(
      "engine-kuzzle",
      InternalCollection.ASSETS,
      "Container-A2",
    );
    expect(assetDocument._source).toMatchObject({
      groups: [],
      measures: {
        position: null,
        temperatureExt: null,
        temperatureInt: null,
        temperatureWeather: null,
      },
      metadata: {
        height: 5,
        person: {
          company: "ACME",
        },
        trailer: null,
        weight: 10,
      },
      lastMeasuredAt: null,
      linkedDevices: [],
      model: "Container",
      reference: "A2",
      softTenant: [],
    });
  });

  it("can get asset", async () => {
    const baseQuery = {
      controller: "device-manager/assets",
      engineId: "engine-ayse",
      action: "get",
    } satisfies Partial<ApiAssetGetRequest>;

    const missingId: Omit<ApiAssetGetRequest, "_id"> = baseQuery;
    await expect(sdk.query(missingId)).rejects.toThrow(
      /^Missing argument "_id".$/,
    );

    const { result } = await sdk.query<ApiAssetGetRequest, ApiAssetGetResult>({
      ...baseQuery,
      _id: assetAyseLinked1Id,
    });
    expect(result._id).toBe(assetAyseLinked1Id);
    expect(result._source).toMatchObject(assetAyseLinked1);
  });

  it("can update asset metadata", async () => {
    const baseQuery = {
      controller: "device-manager/assets",
      engineId: "engine-ayse",
      action: "update",
    } satisfies Partial<ApiAssetUpdateRequest>;

    const missingId: Omit<ApiAssetUpdateRequest, "_id"> = {
      ...baseQuery,
      body: {
        metadata: { weight: 1250 },
      },
    };
    await expect(sdk.query(missingId)).rejects.toThrow(
      /^Missing argument "_id".$/,
    );

    const missingBodyQuery: Omit<ApiAssetUpdateRequest, "body"> = {
      ...baseQuery,
      _id: assetAyseLinked1Id,
    };
    await expect(sdk.query(missingBodyQuery)).rejects.toThrow(
      /^The request must specify a body.$/,
    );

    const { result } = await sdk.query<
      ApiAssetUpdateRequest,
      ApiAssetUpdateResult
    >({
      ...baseQuery,
      _id: assetAyseLinked1Id,
      body: { metadata: { weight: 1250 } },
    });
    expect(result._source).toMatchObject({
      ...assetAyseLinked1,
      metadata: {
        ...assetAyseLinked1.metadata,
        weight: 1250,
      },
    });

    const assetDocument = await sdk.document.get(
      "engine-ayse",
      InternalCollection.ASSETS,
      assetAyseLinked1Id,
    );
    expect(assetDocument._source).toMatchObject({
      ...assetAyseLinked1,
      metadata: {
        ...assetAyseLinked1.metadata,
        weight: 1250,
      },
    });
  });

  it("can delete assets", async () => {
    const baseQuery = {
      controller: "device-manager/assets",
      engineId: "engine-ayse",
      action: "delete",
    } satisfies Partial<ApiAssetDeleteRequest>;

    const missingId: Omit<ApiAssetDeleteRequest, "_id"> = baseQuery;
    await expect(sdk.query(missingId)).rejects.toThrow(
      /^Missing argument "_id".$/,
    );

    const { error, status } = await sdk.query<ApiAssetDeleteRequest>({
      controller: "device-manager/assets",
      engineId: "engine-ayse",
      action: "delete",
      _id: assetAyseLinked1Id,
    });

    expect(error).toBeNull();
    expect(status).toBe(200);
  });

  it("can search assets", async () => {
    const { result } = await sdk.query<
      ApiAssetSearchRequest,
      ApiAssetSearchResult
    >({
      controller: "device-manager/assets",
      engineId: "engine-ayse",
      action: "search",
      body: {
        query: {
          ids: {
            values: [
              assetAyseLinked1Id,
              assetAyseLinked2Id,
              assetAyseUnlinkedId,
            ],
          },
        },
      },
      lang: "koncorde",
    });

    const hits: ApiAssetSearchResult["hits"] = [
      {
        _id: assetAyseLinked1Id,
        _score: 1,
        _source: assetAyseLinked1,
      },
      {
        _id: assetAyseLinked2Id,
        _score: 1,
        _source: assetAyseLinked2,
      },
      {
        _id: assetAyseUnlinkedId,
        _score: 1,
        _source: assetAyseUnlinked,
      },
    ];

    expect(result).toMatchObject({
      fetched: hits.length,
      hits,
      total: hits.length,
    });
  });

  it("should update linked device when deleting asset", async () => {
    await sdk.query({
      controller: "device-manager/assets",
      action: "delete",
      engineId: "engine-ayse",
      _id: assetAyseLinked1Id,
    });

    const assetExists = await sdk.document.exists(
      "engine-ayse",
      InternalCollection.ASSETS,
      "Container-linked1",
    );
    expect(assetExists).toBe(false);

    const deviceDocument = await sdk.document.get(
      "device-manager",
      InternalCollection.DEVICES,
      "DummyTemp-linked1",
    );
    expect(deviceDocument._source).toMatchObject({
      assetId: null,
    });
    const engineDeviceDocument = await sdk.document.get(
      "engine-ayse",
      InternalCollection.DEVICES,
      deviceAyseLinked1Id,
    );
    expect(engineDeviceDocument._source).toMatchObject({
      assetId: null,
    });
  });

  it("can upsert asset", async () => {
    const { result, status } = await sdk.query<
      ApiAssetUpsertRequest,
      ApiAssetUpsertResult
    >({
      controller: "device-manager/assets",
      action: "upsert",
      engineId: "engine-kuzzle",
      body: {
        model: "Container",
        reference: "upsert",
        metadata: { height: 21, weight: 42 },
      },
    });

    expect(status).toBe(200);
    expect(result._id).toBe("Container-upsert");
    expect(result._source.model).toBe("Container");
    expect(result._source.reference).toBe("upsert");
    expect(result._source.metadata).toEqual({
      height: 21,
      person: null,
      trailer: null,
      weight: 42,
    });
  });

  it("can upsert existing asset", async () => {
    const { result, status } = await sdk.query<
      ApiAssetUpsertRequest,
      ApiAssetUpsertResult
    >({
      controller: "device-manager/assets",
      action: "upsert",
      engineId: "engine-ayse",
      body: {
        model: assetAyseLinked1.model,
        reference: assetAyseLinked1.reference,
        metadata: { height: 21, weight: 42 },
      },
    });

    expect(status).toBe(200);
    expect(result._id).toBe(assetAyseLinked1Id);
    expect(result._source.model).toBe(assetAyseLinked1.model);
    expect(result._source.reference).toBe(assetAyseLinked1.reference);
    expect(result._source.metadata).toEqual({
      ...assetAyseLinked1.metadata,
      height: 21,
      weight: 42,
    });
  });
});
