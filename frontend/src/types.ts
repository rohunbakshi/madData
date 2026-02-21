import type { Geometry } from "geojson";

export type CoolingType = "evaporative" | "hybrid" | "air";

export type Project = {
  project_id: string;
  name: string;
  county: string;
  footprint_acres: number;
  change_area_m2: number;
  intensity_score: number;
  date_range: string;
  water_stress_normalized: number;
  center: [number, number];
  geometry: Geometry;
};

export type ScoreResponse = {
  annual_energy_kwh: number;
  annual_water_liters: number;
  olympic_pools: number;
  water_stress_normalized: number;
  impact_score: number;
  tier: "Low" | "Moderate" | "High";
  assumptions: {
    size_mw: number;
    cooling_type: CoolingType;
    wue_l_per_kwh: number;
    formula: string;
  };
};

export type CountySummary = {
  county: string;
  project_count: number;
  total_change_area_m2: number;
  avg_stress: number;
  avg_intensity: number;
  projected_annual_water_liters: number;
  projected_impact_score: number;
  projected_tier: "Low" | "Moderate" | "High";
};

export type ApiMeta = {
  data_source: "sample" | "geojson";
  project_count: number;
  expects_geojson_at: string;
};
