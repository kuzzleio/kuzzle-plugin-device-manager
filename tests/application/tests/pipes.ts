import { Backend } from "kuzzle";

import {
  MeasureContent,
  EventMeasureProcessBefore,
  TemperatureMeasurement,
} from "../../../index";

export function registerTestPipes(app: Backend) {
  app.pipe.register<EventMeasureProcessBefore>(
    "device-manager:measures:process:before",
    async ({ asset, device, measures }) => {
      if (device._id === "DummyTemp-enrich_me_master") {
        for (const measure of measures) {
          if (measure.values.temperature) {
            if (device._source.measures.temperature) {
              if (
                measure.measuredAt <=
                device._source.measures.temperature.measuredAt
              ) {
                throw new Error(
                  `The measure has already been embedded into the device but it shouldn't at this stage of the ingestion pipeline`
                );
              }
            }

            measure.values.temperature *= 2;
          }
        }
      }

      if (device._id === "DummyTemp-compute_me_master") {
        const computedMeasures: MeasureContent[] = [];

        for (const measure of measures) {
          if (measure.type === "temperature") {
            const temperatureInt: MeasureContent = {
              asset: {
                _id: asset._id,
                measureName: "temperatureInt",
                metadata: asset._source.metadata,
                model: asset._source.model,
                reference: asset._source.reference,
              },
              measuredAt: measure.measuredAt,
              origin: {
                type: "computed",
                _id: "compute-temperature-int",
                measureName: "temperatureInt",
                payloadUuids: measure.origin.payloadUuids,
              },
              type: "temperature",
              values: {
                temperature: measure.values.temperature * 2,
              },
            };

            computedMeasures.push(temperatureInt);

            asset._source.measures.temperatureInt = {
              measuredAt: temperatureInt.measuredAt,
              name: "temperatureInt",
              payloadUuids: temperatureInt.origin.payloadUuids,
              type: "temperature",
              values: {
                temperature: temperatureInt.values.temperature,
              },
            };
          }
        }

        for (const computedMeasure of computedMeasures) {
          measures.push(computedMeasure);
        }
      }

      const color = device._source.metadata.color;

      if (color === "test-metadata-history-with-measure") {
        asset._source.metadata.weight = 42042;
        asset._source.metadata.trailer.capacity = 2048;
      }

      if (color === "test-create-new-asset-measure") {
        const measure: MeasureContent<TemperatureMeasurement> = {
          measuredAt: Date.now(),
          asset: {
            _id: asset._id,
            measureName: "temperatureWeather",
            metadata: asset._source.metadata,
            model: asset._source.model,
            reference: asset._source.reference,
          },
          origin: {
            type: "computed",
            _id: "rule-weather-api",
            measureName: "temperatureWeather",
            payloadUuids: ["uuid"],
          },
          type: "temperature",
          values: {
            temperature: 21.21,
          },
        };

        measures.push(measure);

        asset._source.measures.temperatureWeather = {
          name: measure.asset?.measureName as string,
          measuredAt: measure.measuredAt,
          payloadUuids: measure.origin.payloadUuids,
          type: measure.type,
          values: measure.values,
        };
      }

      return { asset, device, measures };
    }
  );
}
