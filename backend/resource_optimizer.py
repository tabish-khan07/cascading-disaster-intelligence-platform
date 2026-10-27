import time
from math import radians, sin, cos, sqrt, atan2

from ortools.linear_solver import pywraplp

from cascade_engine import calculate_cascade, villages
from priority_engine import calculate_priorities
from settlements import VILLAGE_NAMES, VILLAGE_LOCATIONS

RESOURCE_LOCATIONS = {
    "A1": (25.1420, 85.9410),  # Barauni Staging Base
    "A2": (25.1470, 85.9610),  # Sultanganj CHC Base
    "A3": (25.1355, 85.9495),  # Sadar Hospital Base
    "R1": (25.1440, 85.9430),  # SDRF Flood Rescue Team 1
    "R2": (25.1510, 85.9580),  # NDRF Flood Rescue Team 2
    "RB1": (25.1500, 85.9450),  # Barauni Ghat Launch Point
    "RB2": (25.1560, 85.9560),  # Sultanganj Ghat Jetty
}


AMBULANCES = ["A1", "A2", "A3"]
RESCUE_TEAMS = ["R1", "R2"]
RESCUE_BOATS = ["RB1", "RB2"]

AVERAGE_AMBULANCE_SPEED_KMPH = 40.0
AVERAGE_RESCUE_SPEED_KMPH = 30.0
AVERAGE_BOAT_SPEED_KMPH = 15.0
ROAD_DETOUR_FACTOR = 1.5


def calculate_distance_km(
    point1: tuple[float, float],
    point2: tuple[float, float],
) -> float:
    lat1, lon1 = point1
    lat2, lon2 = point2

    earth_radius_km = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


def estimate_travel_time(
    distance_km: float,
    average_speed_kmph: float,
    road_impact: bool,
) -> float:
    if average_speed_kmph <= 0:
        raise ValueError("Average speed must be greater than zero.")

    adjusted_distance = distance_km
    if road_impact:
        adjusted_distance *= ROAD_DETOUR_FACTOR

    return (adjusted_distance / average_speed_kmph) * 60.0


def calculate_assignment_cost(
    resource_id: str,
    village: dict,
    average_speed_kmph: float,
) -> dict:
    village_id = village["village_id"]

    if resource_id not in RESOURCE_LOCATIONS:
        raise ValueError(f"Location missing for resource '{resource_id}'.")

    if village_id not in VILLAGE_LOCATIONS:
        raise ValueError(f"Location missing for village '{village_id}'.")

    distance_km = calculate_distance_km(
        RESOURCE_LOCATIONS[resource_id],
        VILLAGE_LOCATIONS[village_id],
    )

    travel_time_min = estimate_travel_time(
        distance_km=distance_km,
        average_speed_kmph=average_speed_kmph,
        road_impact=village["road_impact"],
    )

    priority_component = village["priority_score"] * 100
    time_penalty = travel_time_min * 0.5
    assignment_score = priority_component - time_penalty

    return {
        "resource": resource_id,
        "village_id": village_id,
        "village_name": VILLAGE_NAMES.get(village_id, village_id),
        "distance_km": round(distance_km, 2),
        "travel_time_min": round(travel_time_min, 2),
        "assignment_score": round(assignment_score, 2),
    }


def allocate_resources_greedy(
    priorities: list[dict],
    resources: list[str],
    average_speed_kmph: float,
    blocked_village_ids: set[str] | None = None,
) -> list[dict]:
    if not priorities or not resources:
        return []

    remaining_villages = {
        village["village_id"]: village
        for village in priorities
        if blocked_village_ids is None or village["village_id"] not in blocked_village_ids
    }

    allocations = []

    for resource_id in resources:
        if not remaining_villages:
            break

        candidates = [
            calculate_assignment_cost(
                resource_id=resource_id,
                village=village,
                average_speed_kmph=average_speed_kmph,
            )
            for village in remaining_villages.values()
        ]

        candidates.sort(
            key=lambda item: item["assignment_score"],
            reverse=True,
        )

        best = candidates[0]
        village = remaining_villages.pop(best["village_id"])
        village_name = VILLAGE_NAMES.get(best["village_id"], best["village_id"])

        if resource_id.startswith("A"):
            resource_type = "AMBULANCE"
            dispatch_mode = "ROAD_AMBULANCE"
        elif resource_id.startswith("RB"):
            resource_type = "RESCUE_BOAT"
            dispatch_mode = "WATERCRAFT_IRB"
        else:
            resource_type = "RESCUE_TEAM"
            dispatch_mode = "AMPHIBIOUS_IRB"

        allocations.append({
            "resource": best["resource"],
            "resource_type": resource_type,
            "dispatch_mode": dispatch_mode,
            "village_id": best["village_id"],
            "village_name": village_name,
            "priority_score": village["priority_score"],
            "priority_level": village["priority_level"],
            "population": village["population"],
            "distance_km": best["distance_km"],
            "estimated_travel_time_min": best["travel_time_min"],
            "assignment_score": best["assignment_score"],
            "reason": (
                f"{village['priority_level']} priority at {village_name}, "
                f"{village['population']:,} people exposed, "
                f"dispatch via {dispatch_mode}, "
                f"estimated travel time: {best['travel_time_min']} min"
            ),
        })

    return allocations


def allocate_resources_ortools(
    priorities: list[dict],
    resources: list[str],
    average_speed_kmph: float,
    blocked_village_ids: set[str] | None = None,
) -> dict:
    """
    Uses Google OR-Tools SCIP integer programming solver.
    Binary decision variable x[r,v] = 1 if resource r is assigned to village v.
    Objective: maximize sum of (priority_score * 100 - travel_penalty) * x[r,v]
    Constraints:
      - Each resource assigned to at most 1 village
      - Each village receives at most 1 resource of this type
      - If blocked_village_ids is set, skip those villages
    """
    if not priorities or not resources:
        return {"allocations": [], "solver_meta": {"solver": "SCIP", "status": "NO_INPUT", "variables": 0, "constraints": 0}}

    # Filter villages based on road accessibility
    eligible_villages = [
        v for v in priorities
        if blocked_village_ids is None or v["village_id"] not in blocked_village_ids
    ]

    if not eligible_villages:
        return {"allocations": [], "solver_meta": {"solver": "SCIP", "status": "NO_ELIGIBLE_VILLAGES", "variables": 0, "constraints": 0}}

    solver = pywraplp.Solver.CreateSolver("SCIP")
    if not solver:
        # Fallback to greedy if SCIP unavailable
        fallback_allocs = allocate_resources_greedy(priorities, resources, average_speed_kmph, blocked_village_ids)
        if isinstance(fallback_allocs, list):
            return {
                "allocations": fallback_allocs,
                "solver_meta": {
                    "solver": "SCIP (Fallback: Greedy)",
                    "status": "FALLBACK",
                    "variables": 0,
                    "constraints": 0,
                },
            }
        return fallback_allocs

    start_time = time.time()

    # Precompute assignment costs
    costs = {}
    for r in resources:
        for v in eligible_villages:
            cost_data = calculate_assignment_cost(r, v, average_speed_kmph)
            costs[(r, v["village_id"])] = cost_data

    # Decision variables: x[r, v_id] ∈ {0, 1}
    x = {}
    for r in resources:
        for v in eligible_villages:
            x[(r, v["village_id"])] = solver.BoolVar(f"x_{r}_{v['village_id']}")

    # Constraint: Each resource assigned to at most 1 village
    for r in resources:
        solver.Add(
            sum(x[(r, v["village_id"])] for v in eligible_villages) <= 1
        )

    # Constraint: Each village gets at most 1 resource of this type
    for v in eligible_villages:
        solver.Add(
            sum(x[(r, v["village_id"])] for r in resources) <= 1
        )

    # Objective: maximize risk-weighted coverage minus travel penalty
    objective = solver.Objective()
    for r in resources:
        for v in eligible_villages:
            score = costs[(r, v["village_id"])]["assignment_score"]
            objective.SetCoefficient(x[(r, v["village_id"])], score)
    objective.SetMaximization()

    status = solver.Solve()
    solve_time_ms = round((time.time() - start_time) * 1000, 1)

    num_variables = solver.NumVariables()
    num_constraints = solver.NumConstraints()

    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        return {
            "allocations": [],
            "solver_meta": {
                "solver": "SCIP",
                "status": "INFEASIBLE",
                "variables": num_variables,
                "constraints": num_constraints,
                "solve_time_ms": solve_time_ms,
            }
        }

    allocations = []
    village_lookup = {v["village_id"]: v for v in eligible_villages}

    for r in resources:
        for v in eligible_villages:
            if x[(r, v["village_id"])].solution_value() > 0.5:
                vid = v["village_id"]
                village = village_lookup[vid]
                cost_data = costs[(r, vid)]
                village_name = VILLAGE_NAMES.get(vid, vid)

                if r.startswith("A"):
                    resource_type = "AMBULANCE"
                    dispatch_mode = "ROAD_AMBULANCE"
                elif r.startswith("RB"):
                    resource_type = "RESCUE_BOAT"
                    dispatch_mode = "WATERCRAFT_IRB"
                else:
                    resource_type = "RESCUE_TEAM"
                    dispatch_mode = "AMPHIBIOUS_IRB"

                allocations.append({
                    "resource": r,
                    "resource_type": resource_type,
                    "dispatch_mode": dispatch_mode,
                    "village_id": vid,
                    "village_name": village_name,
                    "priority_score": village["priority_score"],
                    "priority_level": village["priority_level"],
                    "population": village["population"],
                    "distance_km": cost_data["distance_km"],
                    "estimated_travel_time_min": cost_data["travel_time_min"],
                    "assignment_score": cost_data["assignment_score"],
                    "reason": (
                        f"{village['priority_level']} priority at {village_name}, "
                        f"{village['population']:,} people exposed, "
                        f"dispatch via {dispatch_mode}, "
                        f"ETA: {cost_data['travel_time_min']} min"
                    ),
                })

    solver_meta = {
        "solver": "Google OR-Tools SCIP",
        "status": "OPTIMAL" if status == pywraplp.Solver.OPTIMAL else "FEASIBLE",
        "objective_value": round(solver.Objective().Value(), 3),
        "variables": num_variables,
        "constraints": num_constraints,
        "solve_time_ms": solve_time_ms,
    }

    return {"allocations": allocations, "solver_meta": solver_meta}


# Backwards compatibility alias
allocate_resources = allocate_resources_ortools


def optimize_resources(priorities: list[dict]) -> dict:
    # Identify which villages have road access severed
    road_blocked_villages = {
        v["village_id"] for v in priorities if v.get("road_impact", False)
    }
    road_accessible_villages = {
        v["village_id"] for v in priorities if not v.get("road_impact", False)
    }

    # INTER-MODAL DISPATCH:
    # Ambulances can ONLY go to villages with accessible roads
    # Rescue boats are dispatched to villages with severed road access
    ambulance_result = allocate_resources_ortools(
        priorities=priorities,
        resources=AMBULANCES,
        average_speed_kmph=AVERAGE_AMBULANCE_SPEED_KMPH,
        blocked_village_ids=road_blocked_villages,  # lock out road-severed villages
    )

    boat_result = allocate_resources_ortools(
        priorities=priorities,
        resources=RESCUE_BOATS,
        average_speed_kmph=AVERAGE_BOAT_SPEED_KMPH,
        blocked_village_ids=road_accessible_villages,  # boats only go to flooded areas
    )

    # Also send rescue teams (can go anywhere - they have IRBs)
    rescue_result = allocate_resources_ortools(
        priorities=priorities,
        resources=RESCUE_TEAMS,
        average_speed_kmph=AVERAGE_RESCUE_SPEED_KMPH,
        blocked_village_ids=None,  # rescue teams can go anywhere
    )

    all_allocations = (
        ambulance_result["allocations"]
        + boat_result["allocations"]
        + rescue_result["allocations"]
    )

    ambulance_covered = {a["village_id"] for a in ambulance_result["allocations"]}
    boat_covered = {a["village_id"] for a in boat_result["allocations"]}
    rescue_covered = {a["village_id"] for a in rescue_result["allocations"]}

    all_villages = {v["village_id"] for v in priorities}
    any_covered = ambulance_covered | boat_covered | rescue_covered

    unserved_boat = road_blocked_villages - boat_covered
    unserved_ambulance = road_accessible_villages - ambulance_covered
    unserved_villages = sorted(unserved_boat | unserved_ambulance)

    if unserved_villages:
        unserved_actions = [
            "Request additional IRBs / watercraft from NDRF 9th Bn or neighbouring districts",
            "Pre-position Civil Defence / Home Guard teams at the nearest accessible high-ground point",
            "Issue shelter-in-place advisory with increased monitoring frequency for the unserved villages",
            "Consider helicopter or amphibious support if weather and assets permit",
        ]
    else:
        unserved_actions = [
            "All priority settlements currently covered",
        ]

    return {
        "status": "Optimal" if all_allocations else "No allocation possible",
        "allocations": all_allocations,
        "solver_meta": {
            "ambulance_solver": ambulance_result.get("solver_meta", {}),
            "boat_solver": boat_result.get("solver_meta", {}),
            "rescue_solver": rescue_result.get("solver_meta", {}),
        },
        "ambulance_coverage": {
            "served_villages": sorted(ambulance_covered),
            "unserved_villages": sorted(all_villages - ambulance_covered),
            "total_resources": len(AMBULANCES),
            "resources_used": len(ambulance_result["allocations"]),
        },
        "boat_coverage": {
            "served_villages": sorted(boat_covered),
            "unserved_villages": sorted(road_blocked_villages - boat_covered),
            "total_resources": len(RESCUE_BOATS),
            "resources_used": len(boat_result["allocations"]),
        },
        "rescue_team_coverage": {
            "served_villages": sorted(rescue_covered),
            "unserved_villages": sorted(all_villages - rescue_covered),
            "total_resources": len(RESCUE_TEAMS),
            "resources_used": len(rescue_result["allocations"]),
        },
        "intermodal_dispatch": {
            "road_ambulance_villages": sorted(ambulance_covered),
            "watercraft_irb_villages": sorted(boat_covered),
            "road_blocked_villages": sorted(road_blocked_villages),
        },
        "unserved_settlements": {
            "villages": unserved_villages,
            "recommended_actions": unserved_actions,
        },
    }


if __name__ == "__main__":
    cascade_result = calculate_cascade(0.90)
    priorities = calculate_priorities(cascade_result)
    result = optimize_resources(priorities)

    print("\n========== REAL BIHAR RESOURCE OPTIMIZATION ==========")
    for allocation in result["allocations"]:
        print(
            f"{allocation['resource']} ({allocation['resource_type']}) -> "
            f"{allocation['village_name']} ({allocation['village_id']}) | "
            f"Mode: {allocation.get('dispatch_mode', 'N/A')} | "
            f"Distance: {allocation['distance_km']} km | "
            f"ETA: {allocation['estimated_travel_time_min']} min"
        )
    print("\nSolver Metadata:")
    import pprint
    pprint.pprint(result["solver_meta"])
    print("\nInter-modal Dispatch:")
    pprint.pprint(result["intermodal_dispatch"])
