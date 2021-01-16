import {
  ControllerDefinition,
  KuzzleRequest,
  PreconditionError,
} from 'kuzzle';

import { CRUDController } from './CRUDController';

export class AssetsController extends CRUDController {
  public definition: ControllerDefinition;

  /**
   * Constructor
   *
   * @param context
   */
  constructor(context) {
    super(context, 'assets');

    this.context = context;

    this.definition = {
      actions: {
        create: {
          handler: this.create.bind(this),
          http: [{ verb: 'post', path: 'device-manager/assets' }],
        },
        update: {
          handler: this.update.bind(this),
          http: [{ verb: 'put', path: 'device-manager/asset/:_id' }],
        },
        delete: {
          handler: this.delete.bind(this),
          http: [{ verb: 'delete', path: 'device-manager/asset/:_id' }],
        },
        search: {
          handler: this.search.bind(this),
          http: [
            { verb: 'post', path: 'device-manager/assets/_search' },
            { verb: 'get', path: 'device-manager/assets/_search' },
          ],
        },
      },
    };
  }

  create (request: KuzzleRequest) {
    if (! request.input.resource._id) {
      request.input.resource._id = `${request.input.body.model}/${request.input.body.reference}`;
    }

    return super.create(request);
  }
}
