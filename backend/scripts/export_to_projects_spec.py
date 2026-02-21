"""
Transform backend/data/export.geojson to follow projects.geojson.example spec.
Reads OSM-style export, maps properties to project_id, name, county, footprint_acres,
change_area_m2, intensity_score, date_range, water_stress_normalized; keeps geometry.
Overwrites export.geojson.
"""
import json
import math
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EXPORT_PATH = DATA_DIR / "export.geojson"

# Approximate m² per degree² at given latitude (WGS84)
M_PER_DEG_LAT = 111_320.0


def _ring_area_deg2(ring: list[list[float]]) -> float:
    """Shoelace formula for signed area of a ring (lon, lat). Returns area in deg²."""
    n = len(ring)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
    return abs(area) / 2.0


def _geometry_area_m2(geometry: dict) -> float:
    """Approximate area in m² from GeoJSON geometry (lon/lat)."""
    geom_type = geometry.get("type")
    coords = geometry.get("coordinates", [])
    total_deg2 = 0.0
    rings: list[list[list[float]]] = []

    if geom_type == "Polygon":
        if coords and isinstance(coords[0], list) and coords[0] and isinstance(coords[0][0], (int, float)):
            rings = [coords[0]]  # exterior only for area
        else:
            rings = list(coords) if coords else []
    elif geom_type == "MultiPolygon":
        for poly in coords or []:
            if poly and isinstance(poly[0], list) and poly[0] and isinstance(poly[0][0], (int, float)):
                rings.append(poly[0])
            else:
                for ring in poly or []:
                    rings.append(ring)

    for ring in rings:
        if len(ring) >= 3:
            total_deg2 += _ring_area_deg2(ring)

    if total_deg2 <= 0:
        return 0.0
    # Centroid lat approx from first ring for scale factor
    first_ring = rings[0] if rings else []
    lat_rad = math.radians(sum(p[1] for p in first_ring) / len(first_ring)) if first_ring else 0.0
    deg2_to_m2 = (M_PER_DEG_LAT ** 2) * math.cos(lat_rad)
    return total_deg2 * deg2_to_m2


def _sanitize_project_id(raw: str, idx: int) -> str:
    """e.g. 'relation/19787207' -> 'nova-19787207', 'way/45583050' -> 'nova-45583050'."""
    if not raw:
        return f"nova-{idx:04d}"
    s = re.sub(r"[^a-zA-Z0-9\-_]", "-", str(raw)).strip("-") or f"id-{idx}"
    return f"nova-{s}" if not s.startswith("nova-") else s


def transform_feature(feature: dict, idx: int) -> dict:
    """Convert one OSM-style feature to projects.geojson.example spec."""
    props = feature.get("properties", {})
    geometry = feature.get("geometry")
    if not geometry or not geometry.get("coordinates"):
        return None

    area_m2 = _geometry_area_m2(geometry)
    footprint_acres = round(area_m2 / 4046.8564224, 2) if area_m2 > 0 else 0.0
    raw_id = props.get("@id") or feature.get("id") or props.get("id")
    name = (props.get("name") or props.get("ref") or props.get("operator") or f"Project {idx}").strip()
    county = (props.get("addr:city") or props.get("county") or "Unknown").strip()

    return {
        "type": "Feature",
        "properties": {
            "project_id": _sanitize_project_id(str(raw_id) if raw_id is not None else "", idx),
            "name": name,
            "county": county,
            "footprint_acres": footprint_acres,
            "change_area_m2": int(round(area_m2)),
            "intensity_score": 50,
            "date_range": "2024-01 to 2025-10",
            "water_stress_normalized": 0.5,
        },
        "geometry": geometry,
    }


def main() -> None:
    data = json.loads(EXPORT_PATH.read_text(encoding="utf-8"))
    features_in = data.get("features", [])
    features_out = []
    for idx, f in enumerate(features_in):
        out = transform_feature(f, idx + 1)
        if out is not None:
            features_out.append(out)

    result = {
        "type": "FeatureCollection",
        "features": features_out,
    }
    EXPORT_PATH.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Transformed {len(features_in)} features -> {len(features_out)} (spec: project_id, name, county, footprint_acres, change_area_m2, intensity_score, date_range, water_stress_normalized). Wrote {EXPORT_PATH}")


if __name__ == "__main__":
    main()
