import json

from hazard_engine import analyze_hazard
from cascade_engine import calculate_cascade
from priority_engine import calculate_priorities
from resource_optimizer import optimize_resources


def run_disaster_pipeline(
    rainfall_mm: float = 180.0,
    duration_hours: float = 4.0,
    water_level_m: float = 8.0,
) -> dict:
    hazard_result = analyze_hazard(
        rainfall_mm=rainfall_mm,
        duration_hours=duration_hours,
        water_level_m=water_level_m,
    )

    risk_score = hazard_result["risk_score"]
    cascade_result = calculate_cascade(risk_score)
    priorities = calculate_priorities(cascade_result)
    resource_result = optimize_resources(priorities)

    ambulance_unserved = resource_result["ambulance_coverage"]["unserved_villages"]
    rescue_unserved = resource_result["rescue_team_coverage"]["unserved_villages"]

    if ambulance_unserved or rescue_unserved:
        overall_status = "RESOURCE_CONSTRAINED"
    elif not cascade_result["affected_villages"]:
        overall_status = "NO_AFFECTED_ZONES"
    else:
        overall_status = "FULLY_COVERED"

    return {
        "status": overall_status,
        "event": {
            "type": hazard_result["type"],
            "risk_score": hazard_result["risk_score"],
            "hazard_level": hazard_result["hazard_level"],
            "inputs": {
                "rainfall_mm": rainfall_mm,
                "duration_hours": duration_hours,
                "water_level_m": water_level_m,
            },
        },
        "impact": {
            "affected_roads": cascade_result["affected_roads"],
            "affected_villages": cascade_result["affected_villages"],
            "affected_hospitals": cascade_result["affected_hospitals"],
            "population_affected": cascade_result["population_affected"],
        },
        "priority_assessment": priorities,
        "resource_optimization": resource_result,
        "resource_gaps": {
            "ambulances": ambulance_unserved,
            "rescue_teams": rescue_unserved,
        },
    }


if __name__ == "__main__":
    result = run_disaster_pipeline(
        rainfall_mm=180,
        duration_hours=4,
        water_level_m=8,
    )

    print("\n==============================================")
    print("      CASCADING DISASTER INTELLIGENCE")
    print("==============================================")

    print("\n========== SYSTEM STATUS ==========")
    print("Status:", result["status"])

    print("\n========== HAZARD ANALYSIS ==========")
    print("Type:", result["event"]["type"])
    print("Rainfall:", result["event"]["inputs"]["rainfall_mm"], "mm")
    print("Duration:", result["event"]["inputs"]["duration_hours"], "hours")
    print("Water Level:", result["event"]["inputs"]["water_level_m"], "m")
    print("Risk Score:", result["event"]["risk_score"])
    print("Hazard Level:", result["event"]["hazard_level"])

    print("\n========== CASCADING IMPACT ==========")
    print("Affected Roads:", result["impact"]["affected_roads"])
    print("Affected Villages:", result["impact"]["affected_villages"])
    print("Affected Hospitals:", result["impact"]["affected_hospitals"])
    print("Population Affected:", result["impact"]["population_affected"])

    print("\n========== PRIORITY ASSESSMENT ==========")
    for priority in result["priority_assessment"]:
        print(
            f"{priority['village_id']} | "
            f"Population: {priority['population']} | "
            f"Priority: {priority['priority_score']:.2f} | "
            f"Level: {priority['priority_level']}"
        )

    print("\n========== RESOURCE ALLOCATION ==========")
    for allocation in result["resource_optimization"]["allocations"]:
        print(
            f"{allocation['resource']} "
            f"({allocation['resource_type']}) -> "
            f"{allocation['village_id']} | "
            f"Priority: {allocation['priority_score']:.2f} | "
            f"Distance: {allocation['distance_km']} km | "
            f"ETA: {allocation['estimated_travel_time_min']} min"
        )

    print("\n========== RESOURCE GAPS ==========")
    print("Ambulance Gaps:", result["resource_gaps"]["ambulances"])
    print("Rescue Team Gaps:", result["resource_gaps"]["rescue_teams"])

    print("\n========== FINAL JSON ==========")
    print(json.dumps(result, indent=4))
