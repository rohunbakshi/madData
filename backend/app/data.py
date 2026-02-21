import json
from pathlib import Path

from app.models import ProjectDetail


PROJECTS: list[ProjectDetail] = [
    ProjectDetail(
        project_id="nova-001",
        name="Loudoun East Cluster",
        county="Loudoun",
        footprint_acres=128.4,
        change_area_m2=426000.0,
        intensity_score=89,
        date_range="2024-03 to 2025-10",
        water_stress_normalized=0.78,
        center=[-77.539, 39.078],
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [-77.553, 39.071],
                    [-77.525, 39.071],
                    [-77.525, 39.086],
                    [-77.553, 39.086],
                    [-77.553, 39.071],
                ]
            ],
        },
    ),
    ProjectDetail(
        project_id="nova-002",
        name="Prince William West Expansion",
        county="Prince William",
        footprint_acres=92.7,
        change_area_m2=311500.0,
        intensity_score=74,
        date_range="2024-05 to 2025-11",
        water_stress_normalized=0.62,
        center=[-77.484, 38.792],
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [-77.497, 38.785],
                    [-77.468, 38.785],
                    [-77.468, 38.8],
                    [-77.497, 38.8],
                    [-77.497, 38.785],
                ]
            ],
        },
    ),
    ProjectDetail(
        project_id="nova-003",
        name="Fairfax Utility Corridor Buildout",
        county="Fairfax",
        footprint_acres=57.9,
        change_area_m2=194000.0,
        intensity_score=61,
        date_range="2024-02 to 2025-09",
        water_stress_normalized=0.43,
        center=[-77.368, 38.91],
        geometry={
            "type": "Polygon",
            "coordinates": [
                [
                    [-77.378, 38.903],
                    [-77.353, 38.903],
                    [-77.353, 38.918],
                    [-77.378, 38.918],
                    [-77.378, 38.903],
                ]
            ],
        },
    ),
]


def _geometry_center(geometry: dict) -> list[float]:
    geom_type = geometry.get("type")
    coords = geometry.get("coordinates", [])

    points: list[list[float]] = []
    if geom_type == "Polygon":
        rings = coords if isinstance(coords, list) else []
        for ring in rings:
            points.extend(ring)
    elif geom_type == "MultiPolygon":
        polygons = coords if isinstance(coords, list) else []
        for polygon in polygons:
            for ring in polygon:
                points.extend(ring)

    if not points:
        return [-77.44, 38.92]

    longitudes = [point[0] for point in points]
    latitudes = [point[1] for point in points]
    center_lon = (min(longitudes) + max(longitudes)) / 2
    center_lat = (min(latitudes) + max(latitudes)) / 2
    return [center_lon, center_lat]


def _project_from_feature(feature: dict, idx: int) -> ProjectDetail:
    props = feature.get("properties", {})
    geometry = feature.get("geometry", {})
    project_id = str(props.get("project_id") or props.get("id") or f"project-{idx:03d}")
    return ProjectDetail(
        project_id=project_id,
        name=str(props.get("name") or f"Project {idx}"),
        county=str(props.get("county") or "Unknown"),
        footprint_acres=float(props.get("footprint_acres", 0.0)),
        change_area_m2=float(props.get("change_area_m2", 0.0)),
        intensity_score=int(props.get("intensity_score", 50)),
        date_range=str(props.get("date_range") or "Unknown"),
        water_stress_normalized=float(props.get("water_stress_normalized", 0.5)),
        center=props.get("center") or _geometry_center(geometry),
        geometry=geometry,
    )


def load_projects() -> tuple[list[ProjectDetail], str]:
    data_file = Path(__file__).resolve().parent.parent / "data" / "projects.geojson"
    if not data_file.exists():
        return PROJECTS, "sample"

    try:
        payload = json.loads(data_file.read_text(encoding="utf-8"))
        features = payload.get("features", [])
        loaded = [_project_from_feature(feature, idx + 1) for idx, feature in enumerate(features)]
        if not loaded:
            return PROJECTS, "sample"
        return loaded, "geojson"
    except Exception:
        return PROJECTS, "sample"

def build_project_index(projects: list[ProjectDetail]) -> dict[str, ProjectDetail]:
    return {project.project_id: project for project in projects}
