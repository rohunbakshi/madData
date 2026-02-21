from enum import Enum

from pydantic import BaseModel, Field


class CoolingType(str, Enum):
    evaporative = "evaporative"
    hybrid = "hybrid"
    air = "air"


class ProjectSummary(BaseModel):
    project_id: str
    name: str
    county: str
    footprint_acres: float
    change_area_m2: float
    intensity_score: int = Field(ge=0, le=100)
    date_range: str
    water_stress_normalized: float = Field(ge=0.0, le=1.0)
    center: list[float]


class ProjectDetail(ProjectSummary):
    geometry: dict


class CountySummary(BaseModel):
    county: str
    project_count: int
    total_change_area_m2: float
    avg_stress: float = Field(ge=0.0, le=1.0)
    avg_intensity: float = Field(ge=0.0, le=100.0)
    projected_annual_water_liters: float
    projected_impact_score: float = Field(ge=0.0, le=100.0)
    projected_tier: str


class ScoreRequest(BaseModel):
    project_id: str
    size_mw: int = Field(gt=0)
    cooling_type: CoolingType


class ScoreResponse(BaseModel):
    annual_energy_kwh: float
    annual_water_liters: float
    olympic_pools: float
    water_stress_normalized: float
    impact_score: float
    tier: str
    assumptions: dict
