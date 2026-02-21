import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { type Expression } from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import { calculateScore, fetchCountySummary, fetchMeta, fetchProjects } from "./api";
import type { ApiMeta, CoolingType, CountySummary, Project, ScoreResponse } from "./types";
import { waterStressFallback } from "./waterStressFallback";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const WATER_STRESS_TILE_URL = import.meta.env.VITE_WATER_STRESS_TILE_URL ?? "";

type SizeOption = 20 | 50 | 100;
type DemoStep = {
  title: string;
  action: () => void;
};

function buildProjectFeatureCollection(projects: Project[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: projects.map((project) => ({
      type: "Feature",
      properties: {
        project_id: project.project_id,
        name: project.name,
        intensity_score: project.intensity_score,
      },
      geometry: project.geometry,
    })),
  };
}

function formatMillions(value: number): string {
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showConstruction, setShowConstruction] = useState(true);
  const [showWaterStress, setShowWaterStress] = useState(true);
  const [waterStressOpacity, setWaterStressOpacity] = useState(55);
  const [assumeDataCenter, setAssumeDataCenter] = useState(true);
  const [sizeMw, setSizeMw] = useState<SizeOption>(50);
  const [coolingType, setCoolingType] = useState<CoolingType>("hybrid");
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [countySummary, setCountySummary] = useState<CountySummary[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoStep, setDemoStep] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.project_id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    fetchProjects()
      .then((data) => {
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].project_id);
        }
      })
      .catch(() => setError("Could not load projects from API."));

    fetchMeta().then(setMeta).catch(() => null);
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-77.44, 38.92],
      zoom: 8.9,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);
      map.addSource("projects", { type: "geojson", data: buildProjectFeatureCollection([]) });

      map.addLayer({
        id: "construction-fill",
        type: "fill",
        source: "projects",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "intensity_score"],
            0,
            "#deebf7",
            40,
            "#9ecae1",
            70,
            "#3182bd",
            100,
            "#08519c",
          ] as Expression,
          "fill-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "construction-outline",
        type: "line",
        source: "projects",
        paint: {
          "line-color": "#0b2545",
          "line-width": 1.25,
        },
      });

      if (WATER_STRESS_TILE_URL) {
        map.addSource("water-stress-raster", {
          type: "raster",
          tiles: [WATER_STRESS_TILE_URL],
          tileSize: 256,
        });
        map.addLayer({
          id: "water-stress-layer",
          type: "raster",
          source: "water-stress-raster",
          paint: {
            "raster-opacity": waterStressOpacity / 100,
          },
        });
      } else {
        map.addSource("water-stress-fallback", { type: "geojson", data: waterStressFallback });
        map.addLayer({
          id: "water-stress-layer",
          type: "fill",
          source: "water-stress-fallback",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "stress"],
              0.0,
              "#edf8b1",
              0.5,
              "#7fcdbb",
              1.0,
              "#2c7fb8",
            ] as Expression,
            "fill-opacity": waterStressOpacity / 100,
          },
        });
      }

      map.on("click", "construction-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const projectId = feature.properties?.project_id;
        if (projectId) {
          setSelectedProjectId(projectId);
        }
      });
      map.on("mouseenter", "construction-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "construction-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      setMapLoaded(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded) return;
    const source = mapRef.current?.getSource("projects") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildProjectFeatureCollection(projects));
  }, [projects, mapLoaded]);

  useEffect(() => {
    if (!selectedProject || !mapRef.current) return;
    mapRef.current.flyTo({ center: selectedProject.center, zoom: 10.6, speed: 0.8 });
  }, [selectedProject]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    map.setLayoutProperty("construction-fill", "visibility", showConstruction ? "visible" : "none");
    map.setLayoutProperty(
      "construction-outline",
      "visibility",
      showConstruction ? "visible" : "none",
    );
    map.setLayoutProperty("water-stress-layer", "visibility", showWaterStress ? "visible" : "none");

    if (WATER_STRESS_TILE_URL) {
      map.setPaintProperty("water-stress-layer", "raster-opacity", waterStressOpacity / 100);
    } else {
      map.setPaintProperty("water-stress-layer", "fill-opacity", waterStressOpacity / 100);
    }
  }, [showConstruction, showWaterStress, waterStressOpacity]);

  useEffect(() => {
    if (!selectedProject || !assumeDataCenter) {
      setScore(null);
      return;
    }
    setLoadingScore(true);
    setError(null);
    calculateScore(selectedProject.project_id, sizeMw, coolingType)
      .then(setScore)
      .catch(() => setError("Could not compute scenario score."))
      .finally(() => setLoadingScore(false));
  }, [selectedProject, assumeDataCenter, sizeMw, coolingType]);

  useEffect(() => {
    fetchCountySummary(sizeMw, coolingType).then(setCountySummary).catch(() => null);
  }, [sizeMw, coolingType]);

  const comparisons = useMemo(() => {
    if (!selectedProject || !assumeDataCenter || !score) return null;
    const wue: Record<CoolingType, number> = { evaporative: 1.5, hybrid: 0.7, air: 0.05 };
    const annualEnergy = sizeMw * 1000 * 8760;
    return (["air", "hybrid", "evaporative"] as CoolingType[]).map((type) => ({
      coolingType: type,
      waterLiters: annualEnergy * wue[type],
    }));
  }, [selectedProject, assumeDataCenter, sizeMw, score]);

  const demoSteps: DemoStep[] = [
    {
      title: "1) Show Northern Virginia map",
      action: () => {
        setShowConstruction(false);
        setShowWaterStress(false);
        mapRef.current?.flyTo({ center: [-77.44, 38.92], zoom: 8.9, speed: 0.8 });
      },
    },
    {
      title: "2) Toggle construction heatmap",
      action: () => setShowConstruction(true),
    },
    {
      title: "3) Explain rapid expansion",
      action: () => setShowConstruction(true),
    },
    {
      title: "4) Overlay water stress",
      action: () => setShowWaterStress(true),
    },
    {
      title: "5) Click major cluster",
      action: () => {
        const top = [...projects].sort((a, b) => b.intensity_score - a.intensity_score)[0];
        if (top) {
          setSelectedProjectId(top.project_id);
        }
      },
    },
    {
      title: "6) Toggle Assume Data Center",
      action: () => setAssumeDataCenter(true),
    },
    {
      title: "7) Switch Air to Evaporative",
      action: () => {
        setSizeMw(100);
        setCoolingType("air");
      },
    },
    {
      title: "8) Show water demand jump",
      action: () => setCoolingType("evaporative"),
    },
    {
      title: "9) Show impact score increase",
      action: () => setCoolingType("evaporative"),
    },
    {
      title: "10) Civic planning conclusion",
      action: () => null,
    },
  ];

  function runDemoStep(index: number): void {
    const step = demoSteps[index];
    if (!step) return;
    setDemoStep(index);
    step.action();
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>TerraPulse</h1>
          <p>Early warning for infrastructure-driven water risk in Northern Virginia.</p>
        </div>
      </header>
      <main className="main-grid">
        <section className="map-section">
          {!MAPBOX_TOKEN ? (
            <div className="empty-state">Set VITE_MAPBOX_TOKEN in frontend/.env to render the map.</div>
          ) : (
            <div ref={mapContainerRef} className="map-container" />
          )}
          <div className="legend">
            <h3>Legend</h3>
            <div className="legend-row">
              <span className="swatch swatch-intensity" /> Construction Intensity (Low to High)
            </div>
            <div className="legend-row">
              <span className="swatch swatch-stress" /> Water Stress (Low to High)
            </div>
          </div>
        </section>
        <aside className="panel">
          <h2>Demo Mode</h2>
          <div className="demo-stepper">
            <p className="muted">{demoSteps[demoStep]?.title}</p>
            <div className="demo-buttons">
              <button
                type="button"
                onClick={() => runDemoStep(Math.max(0, demoStep - 1))}
                disabled={demoStep === 0}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => runDemoStep(Math.min(demoSteps.length - 1, demoStep + 1))}
                disabled={demoStep === demoSteps.length - 1}
              >
                Next
              </button>
            </div>
          </div>

          <h2>Scenario Controls</h2>
          <label className="control">
            <input
              type="checkbox"
              checked={showConstruction}
              onChange={(event) => setShowConstruction(event.target.checked)}
            />
            Show Construction Layer
          </label>
          <label className="control">
            <input
              type="checkbox"
              checked={showWaterStress}
              onChange={(event) => setShowWaterStress(event.target.checked)}
            />
            Show Water Stress Overlay
          </label>
          <label className="control">
            Water Stress Opacity: {waterStressOpacity}%
            <input
              type="range"
              min={10}
              max={100}
              value={waterStressOpacity}
              onChange={(event) => setWaterStressOpacity(Number(event.target.value))}
            />
          </label>
          <label className="control">
            <input
              type="checkbox"
              checked={assumeDataCenter}
              onChange={(event) => setAssumeDataCenter(event.target.checked)}
            />
            Assume Data Center
          </label>
          <label className="control">
            Size
            <select value={sizeMw} onChange={(event) => setSizeMw(Number(event.target.value) as SizeOption)}>
              <option value={20}>Small (20 MW)</option>
              <option value={50}>Medium (50 MW)</option>
              <option value={100}>Hyperscale (100 MW)</option>
            </select>
          </label>
          <label className="control">
            Cooling Type
            <select
              value={coolingType}
              onChange={(event) => setCoolingType(event.target.value as CoolingType)}
            >
              <option value="evaporative">Evaporative</option>
              <option value="hybrid">Hybrid</option>
              <option value="air">Air / Near-zero water</option>
            </select>
          </label>
          {selectedProject && (
            <section className="detail">
              <h3>{selectedProject.name}</h3>
              <p>
                <strong>ID:</strong> {selectedProject.project_id}
              </p>
              <p>
                <strong>Footprint:</strong> {selectedProject.footprint_acres.toFixed(1)} acres
              </p>
              <p>
                <strong>Construction Intensity:</strong> {selectedProject.intensity_score}/100
              </p>
              <p>
                <strong>Water Stress:</strong> {(selectedProject.water_stress_normalized * 100).toFixed(0)}%
              </p>
              {!assumeDataCenter ? (
                <p className="muted">Enable "Assume Data Center" to model cooling scenarios.</p>
              ) : loadingScore ? (
                <p className="muted">Computing scenario...</p>
              ) : score ? (
                <>
                  <p>
                    <strong>Annual Water Use:</strong> {formatMillions(score.annual_water_liters)} liters
                  </p>
                  <p>
                    <strong>Olympic Pools:</strong> {score.olympic_pools.toFixed(1)}
                  </p>
                  <p>
                    <strong>Impact Score:</strong> {score.impact_score} ({score.tier})
                  </p>
                  <div className="bars">
                    {comparisons?.map((item) => (
                      <div key={item.coolingType} className="bar-row">
                        <span>{item.coolingType}</span>
                        <div className="bar-track">
                          <div
                            className={`bar-fill ${item.coolingType === coolingType ? "active" : ""}`}
                            style={{ width: `${Math.max((item.waterLiters / (sizeMw * 1000 * 8760 * 1.5)) * 100, 2)}%` }}
                          />
                        </div>
                        <span>{formatMillions(item.waterLiters)}L</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          )}
          <section className="detail">
            <h3>County Risk Ranking</h3>
            {countySummary.map((county) => (
              <p key={county.county}>
                <strong>{county.county}:</strong> score {county.projected_impact_score} (
                {county.projected_tier}) | projects {county.project_count}
              </p>
            ))}
          </section>
          {meta && (
            <p className="muted">
              Data source: <strong>{meta.data_source}</strong> ({meta.project_count} projects)
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </aside>
      </main>
    </div>
  );
}
