from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class Road:
    id: str
    name: str
    risk_threshold: float
    connected_village: str
    connected_hospital: str


@dataclass
class Village:
    id: str
    name: str
    population: int


@dataclass
class Hospital:
    id: str
    name: str
    capacity: int


@dataclass
class PowerSubstation:
    id: str
    name: str
    flood_threshold: float
    connected_hospitals: list


@dataclass
class TelecomTower:
    id: str
    name: str
    flood_threshold: float
    coverage_villages: list


@dataclass
class Shelter:
    id: str
    name: str
    capacity: int
    food_stock_days: float
    water_liters: int
    medical_kits: int


roads: List[Road] = [
    Road(
        id="R1",
        name="NH-31 Flood Embankment Link",
        risk_threshold=0.50,
        connected_village="V1",
        connected_hospital="H1",
    ),
    Road(
        id="R2",
        name="SH-58 Diara Access Corridor",
        risk_threshold=0.65,
        connected_village="V2",
        connected_hospital="H2",
    ),
    Road(
        id="R3",
        name="MDR-14 Rural Embankment Bypass",
        risk_threshold=0.75,
        connected_village="V3",
        connected_hospital="H2",
    ),
    Road(
        id="R4",
        name="Pond Embankment Rural Link",
        risk_threshold=0.60,
        connected_village="V4",
        connected_hospital="H1",
    ),
    Road(
        id="R5",
        name="Sultanganj Ghat Causeway",
        risk_threshold=0.70,
        connected_village="V5",
        connected_hospital="H3",
    ),
]

from settlements import SETTLEMENTS

villages: List[Village] = [
    Village(id=s["id"], name=s["name"], population=s["population"])
    for s in SETTLEMENTS.values()
]

hospitals: List[Hospital] = [
    Hospital(id="H1", name="Barauni Primary Health Centre (PHC)", capacity=60),
    Hospital(id="H2", name="Sadar District Hospital (Begusarai)", capacity=180),
    Hospital(id="H3", name="Sultanganj Community Health Centre (CHC)", capacity=80),
]

substations: List[PowerSubstation] = [
    PowerSubstation(id="P1", name="Barauni 33kV Substation", flood_threshold=0.70, connected_hospitals=["H1", "H3"]),
    PowerSubstation(id="P2", name="Begusarai Grid Feeder", flood_threshold=0.85, connected_hospitals=["H2"]),
]

telecom_towers: List[TelecomTower] = [
    TelecomTower(id="T1", name="Jio 4G BTS Pipra Dewas", flood_threshold=0.60, coverage_villages=["V1", "V4"]),
    TelecomTower(id="T2", name="BSNL Tower Sultanganj", flood_threshold=0.75, coverage_villages=["V2", "V3", "V5"]),
]

shelter_facilities: List[Shelter] = [
    Shelter(id="S1", name="Rajkiya Uchh Vidyalaya (High-Ground Relief Camp)", capacity=850, food_stock_days=3.0, water_liters=8500, medical_kits=12),
    Shelter(id="S2", name="Manjhaul Block Panchayat Bhawan", capacity=600, food_stock_days=2.5, water_liters=5000, medical_kits=8),
]


def calculate_cascade(risk_score: float) -> Dict[str, Any]:
    affected_roads = []
    affected_villages = []
    affected_hospitals = []

    for road in roads:
        if risk_score >= road.risk_threshold:
            affected_roads.append(road.id)

            if road.connected_village not in affected_villages:
                affected_villages.append(road.connected_village)

            if road.connected_hospital not in affected_hospitals:
                affected_hospitals.append(road.connected_hospital)

    population_affected = sum(
        village.population
        for village in villages
        if village.id in affected_villages
    )

    affected_substations = []
    hospitals_on_backup = []
    for sub in substations:
        if risk_score >= sub.flood_threshold:
            affected_substations.append(sub.id)
            for h_id in sub.connected_hospitals:
                if h_id not in hospitals_on_backup:
                    hospitals_on_backup.append(h_id)

    affected_telecom = []
    villages_comm_blackout = []
    for tower in telecom_towers:
        if risk_score >= tower.flood_threshold:
            affected_telecom.append(tower.id)
            for v_id in tower.coverage_villages:
                if v_id not in villages_comm_blackout:
                    villages_comm_blackout.append(v_id)

    # Shelter capacity tracking
    total_shelter_capacity = sum(s.capacity for s in shelter_facilities)
    shelter_occupancy_pct = round(min(100.0, (population_affected / max(total_shelter_capacity, 1)) * 100), 1)
    shelter_status = []
    remaining_population = population_affected
    total_occupied = 0
    any_shelter_full = False

    for s in shelter_facilities:
        occupied = min(s.capacity, remaining_population)
        remaining_population = max(0, remaining_population - occupied)
        total_occupied += occupied
        occ_pct = round((occupied / s.capacity) * 100, 1)
        if occ_pct >= 100.0:
            any_shelter_full = True
        food_remaining = round(s.food_stock_days * (1 - occ_pct / 200), 1)
        status = "CRITICAL_SHORTAGE" if occ_pct >= 90 else "STRAINED" if occ_pct >= 60 else "ADEQUATE"
        shelter_status.append({
            "id": s.id,
            "name": s.name,
            "capacity": s.capacity,
            "occupied": occupied,
            "occupancy_pct": occ_pct,
            "food_remaining_days": food_remaining,
            "water_liters": s.water_liters,
            "medical_kits": s.medical_kits,
            "status": status,
        })

    overflow_population = max(0, population_affected - total_shelter_capacity)

    shelter_overflow = None
    if total_occupied >= total_shelter_capacity or any_shelter_full:
        shelter_overflow = {
            "status": "CAPACITY_EXCEEDED",
            "total_capacity": total_shelter_capacity,
            "total_occupied": total_occupied,
            "overflow_population": overflow_population,
            "recommended_actions": [
                "Activate pre-identified overflow / temporary relief sites",
                "Request additional tents / temporary shelters from DDMA / BSDMA",
                "Prioritise most vulnerable (elderly, children, medical cases) for remaining spaces",
                "Update public messaging to direct new arrivals to overflow locations",
            ],
        }

    return {
        "risk_score": risk_score,
        "affected_roads": affected_roads,
        "affected_villages": affected_villages,
        "affected_hospitals": affected_hospitals,
        "population_affected": population_affected,
        "affected_substations": affected_substations,
        "hospitals_on_backup_power": hospitals_on_backup,
        "affected_telecom": affected_telecom,
        "villages_comm_blackout": villages_comm_blackout,
        "shelter_status": shelter_status,
        "shelter_occupancy_pct": shelter_occupancy_pct,
        "shelter_overflow": shelter_overflow,
        "details": {
            "villages": [
                {"id": v.id, "name": v.name, "population": v.population, "status": "ISOLATED" if v.id in affected_villages else "ACCESSIBLE"}
                for v in villages
            ],
            "hospitals": [
                {"id": h.id, "name": h.name, "capacity": h.capacity, "status": "ACCESS_SEVERED" if h.id in affected_hospitals else "OPERATIONAL"}
                for h in hospitals
            ],
            "roads": [
                {"id": r.id, "name": r.name, "status": "SUBMERGED_BLOCKED" if r.id in affected_roads else "CLEAR"}
                for r in roads
            ],
            "substations": [
                {"id": s.id, "name": s.name, "status": "FLOOD_INUNDATED" if s.id in affected_substations else "OPERATIONAL"}
                for s in substations
            ],
            "telecom": [
                {"id": t.id, "name": t.name, "status": "OFFLINE" if t.id in affected_telecom else "ACTIVE"}
                for t in telecom_towers
            ],
        }
    }


if __name__ == "__main__":
    result = calculate_cascade(0.90)
    print("\n--- CASCADING IMPACT ANALYSIS (REAL BIHAR INFRASTRUCTURE) ---")
    print(f"Risk Score: {result['risk_score']:.2f}")
    print("Affected Roads:", result["affected_roads"])
    print("Affected Villages:", result["affected_villages"])
    print("Affected Hospitals:", result["affected_hospitals"])
    print("Population Affected:", result["population_affected"])
    print("Affected Substations:", result["affected_substations"])
    print("Hospitals on Backup Power:", result["hospitals_on_backup_power"])
    print("Affected Telecom:", result["affected_telecom"])
    print("Villages Comm Blackout:", result["villages_comm_blackout"])
    print("Shelter Occupancy Pct:", result["shelter_occupancy_pct"])
    print("Shelter Status:", result["shelter_status"])
