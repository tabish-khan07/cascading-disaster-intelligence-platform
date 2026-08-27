from data import roads, villages, hospitals, shelters
from optimizer import allocate_resources


def simulate_flood():

    # -----------------------------
    # 1. SIMULATE HAZARD
    # -----------------------------

    roads["R2"]["status"] = "blocked"
    roads["R2"]["risk"] = 0.95

    # -----------------------------
    # 2. CASCADING IMPACT
    # -----------------------------

    affected_villages = [
        village_id
        for village_id, village in villages.items()
        if village["road"] == "R2"
    ]

    affected_hospitals = [
        hospital_id
        for hospital_id, hospital in hospitals.items()
        if hospital["village"] in affected_villages
    ]

    # -----------------------------
    # 3. RISK ZONES
    #
    # Later these risk values can
    # come from your friend's ML model.
    # -----------------------------

    zones = {
        "Zone A": {
            "risk": 0.90,
            "target_id": "V2",
            "target_type": "village",
            "lat": villages["V2"]["lat"],
            "lon": villages["V2"]["lon"],
        },

        "Zone B": {
            "risk": 0.80,
            "target_id": "H2",
            "target_type": "hospital",
            "lat": hospitals["H2"]["lat"],
            "lon": hospitals["H2"]["lon"],
        },

        "Zone C": {
            "risk": 0.40,
            "target_id": "S1",
            "target_type": "shelter",
            "lat": shelters["S1"]["lat"],
            "lon": shelters["S1"]["lon"],
        },
    }

    # -----------------------------
    # 4. RESOURCE OPTIMIZATION
    # -----------------------------

    resource_plan = allocate_resources(zones)

    # -----------------------------
    # 5. RETURN COMPLETE RESPONSE
    # -----------------------------

    return {
        "hazard": "Extreme Rainfall / Flood",
        "blocked_roads": ["R2"],
        "affected_villages": affected_villages,
        "affected_hospitals": affected_hospitals,
        "resource_allocation": resource_plan,
    }