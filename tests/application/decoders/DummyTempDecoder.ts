import { PreconditionError } from "kuzzle";
import { JSONObject } from "kuzzle-sdk";

import {
  Decoder,
  DecodedPayload,
  TemperatureMeasurement,
  BatteryMeasurement,
} from "../../../index";
import { AccelerationMeasurement } from "../measures/Acceleration";
import { isMeasureDated } from "../../helpers/payloads";

export class DummyTempDecoder extends Decoder {
  public measures = [
    { name: "temperature", type: "temperature" },
    { name: "accelerationSensor", type: "acceleration" },
    { name: "battery", type: "battery" },
  ] as const;

  constructor() {
    super();

    this.payloadsMappings = {
      deviceEUI: { type: "keyword" },
    };
  }

  async validate(rawPayload: JSONObject) {
    if (rawPayload.measurements && rawPayload.measurements.length === 0) {
      return false;
    }

    const payloads: any[] = rawPayload.measurements ?? [rawPayload];

    return payloads.every((payload) => {
      if (!payload.deviceEUI) {
        throw new PreconditionError('Invalid payload: missing "deviceEUI"');
      }

      return !payload.invalid;
    });
  }

  async decode(
    decodedPayload: DecodedPayload<DummyTempDecoder>,
    rawPayload: JSONObject,
  ): Promise<DecodedPayload<DummyTempDecoder>> {
    this.log.info("Decoding payload");
    const payloads: any[] = rawPayload.measurements ?? [rawPayload];

    for (const payload of payloads) {
      this.decodeSimplePayload(decodedPayload, payload);
    }

    return decodedPayload;
  }

  decodeSimplePayload(
    decodedPayload: DecodedPayload<DummyTempDecoder>,
    payload: JSONObject,
  ): void {
    if (payload?.metadata?.color) {
      decodedPayload.addMetadata(payload.deviceEUI, {
        color: payload.metadata.color,
      });
    }

    decodedPayload.addMeasurement<TemperatureMeasurement>(
      payload.deviceEUI,
      "temperature",
      {
        measuredAt: isMeasureDated(payload.temperature)
          ? payload.temperature.measuredAt
          : (payload.measuredAt ?? Date.now()),
        type: "temperature",
        values: {
          temperature: isMeasureDated(payload.temperature)
            ? payload.temperature.value
            : payload.temperature,
        },
      },
    );

    if (payload.acceleration !== undefined) {
      const acceleration = isMeasureDated(payload.acceleration)
        ? payload.acceleration.value
        : payload.acceleration;

      decodedPayload.addMeasurement<AccelerationMeasurement>(
        payload.deviceEUI,
        "accelerationSensor",
        {
          measuredAt: isMeasureDated(payload.acceleration)
            ? payload.acceleration.measuredAt
            : (payload.measuredAt ?? Date.now()),
          type: "acceleration",
          values: {
            acceleration: {
              x: acceleration.x,
              y: acceleration.y,
              z: acceleration.z,
            },
            accuracy: acceleration.accuracy,
          },
        },
      );
    }

    decodedPayload.addMeasurement<BatteryMeasurement>(
      payload.deviceEUI,
      "battery",
      {
        measuredAt: isMeasureDated(payload.battery)
          ? payload.battery.measuredAt
          : (payload.measuredAt ?? Date.now()),
        type: "battery",
        values: {
          battery: isMeasureDated(payload.battery)
            ? payload.battery.value
            : payload.battery,
        },
      },
    );

    if (payload.unknownMeasure) {
      decodedPayload.addMeasurement<TemperatureMeasurement>(
        payload.deviceEUI,
        // @ts-expect-error
        "unknownMeasureName",
        {
          measuredAt: Date.now(),
          type: "temperature",
          values: {
            temperature: payload.unknownMeasure,
          },
        },
      );
    }
  }
}
