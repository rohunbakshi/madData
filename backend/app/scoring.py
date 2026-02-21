from app.models import CoolingType, ProjectDetail, ScoreResponse

HOURS_PER_YEAR = 8760
LITERS_PER_OLYMPIC_POOL = 2_500_000

WUE_L_PER_KWH = {
    CoolingType.evaporative: 1.5,
    CoolingType.hybrid: 0.7,
    CoolingType.air: 0.05,
}


def normalize_water_demand(annual_water_liters: float) -> float:
    # Hackathon calibration point: 100 MW evaporative ~= high-demand ceiling.
    max_reference = 100 * HOURS_PER_YEAR * 1000 * WUE_L_PER_KWH[CoolingType.evaporative]
    return max(0.0, min(annual_water_liters / max_reference, 1.0))


def tier_for_score(score: float) -> str:
    if score <= 30:
        return "Low"
    if score <= 60:
        return "Moderate"
    return "High"


def calculate_score(project: ProjectDetail, size_mw: int, cooling_type: CoolingType) -> ScoreResponse:
    annual_energy_kwh = size_mw * 1000 * HOURS_PER_YEAR
    annual_water_liters = annual_energy_kwh * WUE_L_PER_KWH[cooling_type]
    demand_norm = normalize_water_demand(annual_water_liters)
    impact_score = 100 * (demand_norm * project.water_stress_normalized)
    olympic_pools = annual_water_liters / LITERS_PER_OLYMPIC_POOL

    return ScoreResponse(
        annual_energy_kwh=annual_energy_kwh,
        annual_water_liters=annual_water_liters,
        olympic_pools=olympic_pools,
        water_stress_normalized=project.water_stress_normalized,
        impact_score=round(impact_score, 2),
        tier=tier_for_score(impact_score),
        assumptions={
            "size_mw": size_mw,
            "cooling_type": cooling_type.value,
            "wue_l_per_kwh": WUE_L_PER_KWH[cooling_type],
            "formula": "Impact Score = 100 x (Normalized Water Demand x Water Stress)",
        },
    )
