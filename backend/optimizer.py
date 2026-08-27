from ortools.linear_solver import pywraplp


def allocate_resources(zones):
    """
    Allocate ambulances to zones based on risk.

    zones format:
    {
        "Zone A": {
            "risk": 0.90,
            "target_id": "V2",
            "target_type": "village",
            "lat": 28.4820,
            "lon": 77.5100
        }
    }
    """

    solver = pywraplp.Solver.CreateSolver("SCIP")

    if not solver:
        raise RuntimeError("Could not create optimization solver.")

    ambulances = ["A1", "A2", "A3"]

    # Decision variable:
    # x[ambulance, zone] = 1 if ambulance is assigned to zone
    x = {}

    for ambulance in ambulances:
        for zone in zones:
            x[ambulance, zone] = solver.BoolVar(
                f"{ambulance}_{zone}"
            )

    # Each ambulance can be assigned to at most one zone
    for ambulance in ambulances:
        solver.Add(
            sum(x[ambulance, zone] for zone in zones) <= 1
        )

    # At most one ambulance per zone for this MVP
    for zone in zones:
        solver.Add(
            sum(x[ambulance, zone] for ambulance in ambulances) <= 1
        )

    # Maximize total risk coverage
    objective = solver.Objective()

    for ambulance in ambulances:
        for zone in zones:
            objective.SetCoefficient(
                x[ambulance, zone],
                zones[zone]["risk"]
            )

    objective.SetMaximization()

    status = solver.Solve()

    if status != pywraplp.Solver.OPTIMAL:
        return {
            "status": "No optimal allocation found",
            "allocation": []
        }

    allocation = []

    for ambulance in ambulances:
        for zone in zones:
            if x[ambulance, zone].solution_value() > 0.5:

                allocation.append({
                    "ambulance": ambulance,
                    "zone": zone,
                    "risk": zones[zone]["risk"],
                    "target_id": zones[zone]["target_id"],
                    "target_type": zones[zone]["target_type"],
                    "lat": zones[zone]["lat"],
                    "lon": zones[zone]["lon"],
                })

    return {
        "status": "Optimal",
        "allocation": allocation
    }