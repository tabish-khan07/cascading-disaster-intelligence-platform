from dataclasses import dataclass
from typing import List


@dataclass
class Road:
    id: str
    risk_threshold: float
    connected_village: str
    connected_hospital: str


@dataclass
class Village:
    id: str
    population: int


@dataclass
class Hospital:
    id: str
    capacity: int


roads: List[Road] = [
    Road(
        id="R1",
        risk_threshold=0.50,
        connected_village="V1",
        connected_hospital="H1",
    ),
    Road(
        id="R2",
        risk_threshold=0.65,
        connected_village="V2",
        connected_hospital="H2",
    ),
    Road(
        id="R3",
        risk_threshold=0.75,
        connected_village="V3",
        connected_hospital="H2",
    ),
]

villages: List[Village] = [
    Village(id="V1", population=1500),
    Village(id="V2", population=3200),
    Village(id="V3", population=2200),
]

hospitals: List[Hospital] = [
    Hospital(id="H1", capacity=100),
    Hospital(id="H2", capacity=150),
]


def calculate_cascade(risk_score: float):
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

    return {
        "risk_score": risk_score,
        "affected_roads": affected_roads,
        "affected_villages": affected_villages,
        "affected_hospitals": affected_hospitals,
        "population_affected": population_affected,
    }


if __name__ == "__main__":
    result = calculate_cascade(0.90)

    print("\n--- CASCADING IMPACT ANALYSIS ---")
    print(f"Risk Score: {result['risk_score']:.2f}")
    print("Affected Roads:", result["affected_roads"])
    print("Affected Villages:", result["affected_villages"])
    print("Affected Hospitals:", result["affected_hospitals"])
    print("Population Affected:", result["population_affected"])
