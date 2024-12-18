import { KDocument } from "kuzzle-sdk";

import { AssetContent, AssetMeasureContext } from "../types/AssetContent";

export class AssetSerializer {
  static id(model: string, reference: string) {
    return `${model}-${reference}`;
  }

  static serialize(asset: KDocument<AssetContent>): KDocument<AssetContent> {
    if (!asset) {
      return undefined;
    }

    return {
      _id: asset._id,
      _source: asset._source,
    };
  }

  /**
   * Get asset description to contextualize measure data point
   */
  static measureContext(
    asset: KDocument<AssetContent>,
    measureName: string,
  ): AssetMeasureContext {
    return {
      _id: asset._id,
      groups: asset._source.groups,
      measureName,
      metadata: asset._source.metadata,
      model: asset._source.model,
      reference: asset._source.reference,
      softTenant: asset._source.softTenant,
    };
  }
}
