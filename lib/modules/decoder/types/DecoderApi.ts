import { DecoderContent } from "./DecoderContent";

interface DecodersControllerRequest {
  controller: "device-manager/decoders";
}

export interface ApiDecoderListRequest extends DecodersControllerRequest {
  action: "list";
}
export type ApiDecoderListResult = {
  decoders: DecoderContent[];
};

export interface ApiDecoderPrunePayloadsRequest
  extends DecodersControllerRequest {
  action: "prunePayloads";

  _id: string;
}
export type ApiDecoderPrunePayloadsResult = {
  deleted: number;
};
