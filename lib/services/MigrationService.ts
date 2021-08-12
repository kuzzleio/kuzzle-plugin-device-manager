import { JSONObject, PluginContext } from 'kuzzle';

export class MigrationService {
  private config: JSONObject;
  private context: PluginContext;

  get sdk () {
    return this.context.accessors.sdk;
  }

  constructor (config: JSONObject, context: PluginContext) {
    this.config = config;
    this.context = context;
  }

  async run () {
    global.app.install('auto-version', async () => {
      await this.engineCollection();
    });
  }

  /**
   * Migrate the engine documents into the new config collection
   */
  private async engineCollection () {
    this.context.log.info('Migrate engine documents into the config collection...');

    let result = await this.sdk.document.search(
      'device-manager',
      'engines',
      {},
      { scroll: '1s', size: 100 });

    let count = 0;
    while (result) {
      const documents = [];

      for (const { _id, _source } of result.hits) {
        documents.push({
          _id,
          _source: {
            type: 'engine-device-manager',
            engine: { index: _source.index },
          },
        });
      }

      await this.sdk.document.mCreate(this.config.adminIndex, 'config', documents, {
        strict: true,
      });

      count += documents.length;

      result = await result.next();
    }

    this.context.log.info(`Successfully migrated ${count} documents.`);
  }
}
