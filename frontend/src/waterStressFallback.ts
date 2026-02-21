import type { FeatureCollection } from "geojson";

export const waterStressFallback: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { stress: 0.75, name: "Loudoun Stress Zone" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-77.61, 39.0],
            [-77.45, 39.0],
            [-77.45, 39.16],
            [-77.61, 39.16],
            [-77.61, 39.0],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { stress: 0.58, name: "Prince William Stress Zone" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-77.58, 38.72],
            [-77.36, 38.72],
            [-77.36, 38.86],
            [-77.58, 38.86],
            [-77.58, 38.72],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { stress: 0.41, name: "Fairfax Stress Zone" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-77.5, 38.86],
            [-77.22, 38.86],
            [-77.22, 39.02],
            [-77.5, 39.02],
            [-77.5, 38.86],
          ],
        ],
      },
    },
  ],
};
