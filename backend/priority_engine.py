from cascade_engine import roads, villages


def calculate_village_priority(
    village_id: str,
    risk_score: float,
    affected_road_ids: list[str],
    affected_hospital_ids: list[str],
) -> dict:
    village = next(
        (v for v in villages if v.id == village_id),
        None,
    )

    if village is None:
        raise ValueError(f"Village '{village_id}' not found.")

    connected_roads = [
        road for road in roads if road.connected_village == village_id
    ]

    connected_hospital_ids = {
        road.connected_hospital for road in connected_roads
    }

    population_score = min(village.population / 5000.0, 1.0)

    road_impact = 1.0 if any(
        road.id in affected_road_ids for road in connected_roads
    ) else 0.0

    hospital_impact = 1.0 if any(
        hospital_id in affected_hospital_ids
        for hospital_id in connected_hospital_ids
    ) else 0.0

    priority_score = (
        0.45 * risk_score
        + 0.25 * population_score
        + 0.15 * road_impact
        + 0.15 * hospital_impact
    )

    priority_score = max(0.0, min(priority_score, 1.0))

    if priority_score >= 0.75:
        priority_level = "CRITICAL"
    elif priority_score >= 0.50:
        priority_level = "HIGH"
    else:
        priority_level = "MEDIUM"

    return {
        "village_id": village_id,
        "population": village.population,
        "priority_score": round(priority_score, 2),
        "priority_level": priority_level,
        "road_impact": bool(road_impact),
        "hospital_impact": bool(hospital_impact),
    }


def calculate_priorities(cascade_result: dict) -> list[dict]:
    risk_score = cascade_result["risk_score"]
    affected_roads = cascade_result["affected_roads"]
    affected_villages = cascade_result["affected_villages"]
    affected_hospitals = cascade_result["affected_hospitals"]

    priorities = [
        calculate_village_priority(
            village_id=village_id,
            risk_score=risk_score,
            affected_road_ids=affected_roads,
            affected_hospital_ids=affected_hospitals,
        )
        for village_id in affected_villages
    ]

    priorities.sort(
        key=lambda item: item["priority_score"],
        reverse=True,
    )

    return priorities


if __name__ == "__main__":
    from cascade_engine import calculate_cascade

    cascade_result = calculate_cascade(0.90)
    priorities = calculate_priorities(cascade_result)

    print("\n--- PRIORITY ASSESSMENT ---")
    for item in priorities:
        print(
            f"{item['village_id']} | "
            f"Population: {item['population']} | "
            f"Priority: {item['priority_score']:.2f} | "
            f"Level: {item['priority_level']} | "
            f"Road Impact: {item['road_impact']} | "
            f"Hospital Impact: {item['hospital_impact']}"
        )
