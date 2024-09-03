import { DigitalTwinContent, Metadata } from "../../shared";

/**
 * Device document content
 */
export interface DeviceContent<TMetadata extends Metadata = any>
  extends DigitalTwinContent<TMetadata> {
  /**
   * Linked asset unique identifier
   */
  assetId: string | null;

  /**
   */
  engineId: string;
}
