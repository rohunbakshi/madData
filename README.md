# TerraPulse (MadData '26)

Early warning for infrastructure-driven water risk in Northern Virginia.

## What is included

- `backend/` FastAPI service with:
  - `GET /projects`
  - `GET /projects/{id}`
  - `POST /score`
  - `GET /counties/summary`
  - `GET /meta`
- `frontend/` React + Mapbox interactive demo with:
  - Construction intensity polygons
  - Water stress overlay (raster URL support + GeoJSON fallback)
  - Scenario controls (assume data center, size MW, cooling type)
  - Annual water demand + impact score + cooling comparison bars
  - Demo Mode stepper aligned to the 10-step script
  - County risk ranking for current scenario

## Quick start

### 1) Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`.

### 2) Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Set `VITE_MAPBOX_TOKEN` in `frontend/.env`.

Frontend runs on `http://localhost:5173`.

## Model transparency

- Annual energy = `MW * 8760 * 1000` (kWh)
- Annual water = `energy * WUE`
- WUE defaults:
  - evaporative: `1.5 L/kWh`
  - hybrid: `0.7 L/kWh`
  - air: `0.05 L/kWh`
- Impact score = `100 * (normalized demand * normalized stress)`
- Tiers: `0-30 Low`, `31-60 Moderate`, `61-100 High`

## Notes

- Project polygons are loaded from `backend/data/projects.geojson` if present.
- If that file is missing, the backend uses built-in sample data.
- If you have a precomputed water stress tile service, set `VITE_WATER_STRESS_TILE_URL` for a true raster overlay.

## What you need to add for real demo data

### 1) Add GEE project export file

Create:

`backend/data/projects.geojson`

Use `backend/data/projects.geojson.example` as the schema template.

Each feature should include these properties:

- `project_id` (string)
- `name` (string)
- `county` (string)
- `footprint_acres` (number)
- `change_area_m2` (number)
- `intensity_score` (0-100)
- `date_range` (string)
- `water_stress_normalized` (0-1)

Geometry should be Polygon or MultiPolygon in EPSG:4326 (`lon,lat`).

### 2) Add Mapbox token

In `frontend/.env`:

`VITE_MAPBOX_TOKEN=pk....`

### 3) Optional: Add water stress raster tiles

If you exported a raster tile service, set:

`VITE_WATER_STRESS_TILE_URL=https://.../{z}/{x}/{y}.png`

If not set, the app uses a fallback stress overlay.

## GEE export guidance (minimum)

- Export project polygons as GeoJSON FeatureCollection.
- During export, map your computed metrics to the property names listed above.
- Keep `intensity_score` normalized to `0-100`.
- Keep `water_stress_normalized` normalized to `0-1`.

## Demo usage

- Use **Demo Mode** `Next`/`Prev` buttons in the side panel to walk judges through the script.
- Step 8/9 switches from air-like assumptions to evaporative assumptions to highlight demand and score increase.