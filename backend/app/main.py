from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.data import build_project_index, load_projects
from app.models import CountySummary, CoolingType, ProjectDetail, ProjectSummary, ScoreRequest, ScoreResponse
from app.scoring import calculate_score, tier_for_score

app = FastAPI(
    title="TerraPulse API",
    description="Early warning API for infrastructure-driven water risk in Northern Virginia.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECTS, DATA_SOURCE = load_projects()
PROJECT_INDEX = build_project_index(PROJECTS)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "data_source": DATA_SOURCE, "project_count": len(PROJECTS)}


@app.get("/projects", response_model=list[ProjectSummary])
def list_projects() -> list[ProjectSummary]:
    return PROJECTS


@app.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str) -> ProjectDetail:
    project = PROJECT_INDEX.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.post("/score", response_model=ScoreResponse)
def score_project(payload: ScoreRequest) -> ScoreResponse:
    project = PROJECT_INDEX.get(payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return calculate_score(
        project=project,
        size_mw=payload.size_mw,
        cooling_type=payload.cooling_type,
    )


@app.get("/meta")
def meta() -> dict:
    return {
        "data_source": DATA_SOURCE,
        "project_count": len(PROJECTS),
        "expects_geojson_at": "backend/data/projects.geojson",
    }


@app.get("/counties/summary", response_model=list[CountySummary])
def county_summary(size_mw: int = 50, cooling_type: CoolingType = CoolingType.hybrid) -> list[CountySummary]:
    if size_mw <= 0:
        raise HTTPException(status_code=400, detail="size_mw must be greater than 0")

    grouped: dict[str, list[ProjectDetail]] = {}
    for project in PROJECTS:
        grouped.setdefault(project.county, []).append(project)

    response: list[CountySummary] = []
    for county, projects in grouped.items():
        project_count = len(projects)
        total_change_area_m2 = sum(project.change_area_m2 for project in projects)
        avg_stress = sum(project.water_stress_normalized for project in projects) / project_count
        avg_intensity = sum(project.intensity_score for project in projects) / project_count

        # County projection assumes each detected project is configured with the selected scenario.
        project_scores = [calculate_score(project, size_mw=size_mw, cooling_type=cooling_type) for project in projects]
        projected_annual_water_liters = sum(item.annual_water_liters for item in project_scores)
        projected_impact_score = sum(item.impact_score for item in project_scores) / project_count

        response.append(
            CountySummary(
                county=county,
                project_count=project_count,
                total_change_area_m2=round(total_change_area_m2, 2),
                avg_stress=round(avg_stress, 3),
                avg_intensity=round(avg_intensity, 1),
                projected_annual_water_liters=round(projected_annual_water_liters, 2),
                projected_impact_score=round(projected_impact_score, 2),
                projected_tier=tier_for_score(projected_impact_score),
            )
        )
    return sorted(response, key=lambda item: item.projected_impact_score, reverse=True)
