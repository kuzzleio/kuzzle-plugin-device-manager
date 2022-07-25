import { MetadataContent } from '../types/MetadataContent';
import { AssetCategoryContent, FormattedMetadata, FormattedValue } from '../types/AssetCategoryContent';
import { JSONObject, Plugin, PluginContext } from 'kuzzle';
import { DeviceManagerConfiguration } from '../types';

export class AssetCategoryService {

  private config: DeviceManagerConfiguration;
  private context: PluginContext;

  private get sdk () {
    return this.context.accessors.sdk;
  }

  constructor (plugin: Plugin) {
    this.config = plugin.config as any;
    this.context = plugin.context;
  }

  async getMetadataFromId (assetCategory : AssetCategoryContent, engineId :string, metadataList) {
    if ( assetCategory.assetMetadata && assetCategory.assetMetadata.length ) {
      const metadataContents = await this.sdk.document.mGet<MetadataContent>(engineId, 'metadata', assetCategory.assetMetadata);
      for (const metadataContent of metadataContents.successes) {
        metadataList.push({
          'mandatory': metadataContent._source.mandatory,
          'name': metadataContent._source.name,
          'unit': metadataContent._source.unit,
          'valueList': metadataContent._source.valueList,
          'valueType': metadataContent._source.valueType,
        });
      }
    }
  }
  
  async getMetadata (assetCategory : AssetCategoryContent, engineId : string) : Promise<MetadataContent[]> {
    let metadataList;
    metadataList = [];
    await this.getMetadataFromId(assetCategory, engineId, metadataList);

    let assetCategoryTmp = assetCategory;
    while (assetCategoryTmp?.parent) {
      try {
        const parent = await this.sdk.document.get<AssetCategoryContent>(engineId, 'asset-category', assetCategoryTmp.parent);
        await this.getMetadataFromId(parent._source, engineId, metadataList);
        assetCategoryTmp = parent._source;
      }
      catch (e) {
        assetCategoryTmp = null;
      }
    }
    return metadataList;
  }

  async getMetadataValues (assetCategory : AssetCategoryContent, engineId : string) : Promise<FormattedMetadata[]> {
    let getMetadataValues;
    if (! assetCategory.metadataValues ) {
      getMetadataValues = [];
    }
    else {
      getMetadataValues = JSON.parse(JSON.stringify(assetCategory.metadataValues));
    }
    let assetCategoryTmp = assetCategory;
    while (assetCategoryTmp?.parent) {
      try {
        const parent = await this.sdk.document.get<AssetCategoryContent>(engineId, 'asset-category', assetCategoryTmp.parent);
        if (parent._source.metadataValues) {
          getMetadataValues = getMetadataValues.concat(parent._source.metadataValues);
        }
        assetCategoryTmp = parent._source;
      }
      catch (e) {
        assetCategoryTmp = null;
      }
    }
    return getMetadataValues;
  }


  async validateMetadata (assetMetadata : JSONObject, engineId : string, category : string) {
    const assetCategory = await this.sdk.document.get<AssetCategoryContent>(engineId, 'asset-category', category);
    const [metadataList, metadataValues] = await Promise.all([
      await this.getMetadata(assetCategory._source, engineId),
      await this.getMetadataValues(assetCategory._source, engineId)
    ]);
    for (const metadata of metadataList) {
      if (metadata.mandatory) {
        if (! (assetMetadata[metadata.name]) && ! this.containsValue(metadataValues, metadata.name)) {
          throw global.app.errors.get('device-manager', 'assetController', 'MandatoryMetadata', metadata.name);
        }
      }
      if (metadata.valueList) {
        if (! metadata.valueList.includes(assetMetadata[metadata.name])) {
          throw global.app.errors.get('device-manager', 'assetController', 'EnumMetadata', metadata.name, assetMetadata[metadata.name]);
        }
      }
    }
  }

  containsValue (metadataValues : FormattedMetadata[], name : string): Boolean {
    for (const metadata of metadataValues) {
      if (metadata.key === name) {
        return true;
      }
    } 
    return false;
  }

  getMetadataValue (metadataValues : FormattedMetadata[], name : string) : FormattedMetadata {
    for (const metadata of metadataValues) {
      if (metadata.key === name) {
        return metadata;
      }
    }
    return null;
  }
  
  
  async formatValue (value : any) {
    let formattedValue : FormattedValue = {};
    if (typeof value === 'number' ) {
      formattedValue.integer = value;
    }
    else if (typeof value === 'boolean') {
      formattedValue.boolean = value;
    } else if (value.lat){
      formattedValue.geo_point = value;
    }
    else {
      formattedValue.keyword = value;
    }
    return formattedValue;
  }

  async formatMetadataForES (assetMetadata : JSONObject): Promise<FormattedMetadata[]> {
    if (! assetMetadata) {
      return [];
    }
    const formattedMetadata : FormattedMetadata[] = [];
    for ( const [key, value] of Object.entries(assetMetadata)) {
      formattedMetadata.push({ key, value: await this.formatValue(value) });
    }
    return formattedMetadata;
  }

  async formatMetadataForGet (assetMetadata : FormattedMetadata[]) {
    const formattedMetadata : JSONObject = {};
    for (const metadata of assetMetadata) {
      formattedMetadata[metadata.key] = this.getValue(metadata.value);
    }
    return formattedMetadata;
  }

  getValue (value: FormattedValue) {
    if (value.keyword) {
      return value.keyword;
    }
    else if (value.integer || value.integer === 0) {
      return value.integer;
    }
    else if (value.geo_point ) {
      return value.geo_point;
    }
    return value.boolean;
  }
  
}
