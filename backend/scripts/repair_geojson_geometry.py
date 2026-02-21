"""
Repair projects.geojson: convert MultiPoint (or empty) geometry to Polygon
using each feature's properties.center and change_area_m2.
"""
import json
import math
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
GEOJSON_PATH = DATA_DIR / "projects.geojson"


def m_to_deg(m: float, lat: float) -> tuple[float, float]:
    """Convert meters to approximate degrees (lon, lat) at given latitude."""
    lat_rad = math.radians(lat)
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(lat_rad)
    d_lon = m / m_per_deg_lon
    d_lat = m / m_per_deg_lat
    return d_lon, d_lat


def feature_to_polygon(feature: dict) -> dict:
    """Replace geometry with a square Polygon from center + area."""
    props = feature.get("properties", {})
    center = props.get("center")
    if not center or len(center) != 2:
        center = [-77.44, 38.92]  # fallback NoVA
    lon, lat = float(center[0]), float(center[1])
    area_m2 = float(props.get("change_area_m2") or props.get("footprint_acres", 0) * 4046.86 or 10_000)
    if area_m2 <= 0:
        area_m2 = 10_000
    half_side_m = math.sqrt(area_m2) / 2.0
    d_lon, d_lat = m_to_deg(half_side_m, lat)
    # Closed ring (5 points)
    coordinates = [
        [lon - d_lon, lat - d_lat],
        [lon + d_lon, lat - d_lat],
        [lon + d_lon, lat + d_lat],
        [lon - d_lon, lat + d_lat],
        [lon - d_lon, lat - d_lat],
    ]
    return {
        **feature,
        "geometry": {"type": "Polygon", "coordinates": [coordinates]},
    }


def main() -> None:
    data = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    features = data.get("features", [])
    repaired = [feature_to_polygon(f) for f in features]
    data["features"] = repaired
    GEOJSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    types_after = {}
    for f in data["features"]:
        t = f["geometry"]["type"]
        types_after[t] = types_after.get(t, 0) + 1
    print(f"Repaired {len(repaired)} features -> Polygon. Geometry types: {types_after}")


if __name__ == "__main__":
    main()
