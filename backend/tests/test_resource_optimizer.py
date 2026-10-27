import pytest
from resource_optimizer import (
    optimize_resources,
    calculate_distance_km,
    estimate_travel_time,
    AMBULANCES,
    RESCUE_BOATS,
    RESCUE_TEAMS,
)


def test_distance_calculation():
    # Barauni to Sultanganj Diara coordinates
    dist = calculate_distance_km((25.148, 85.950), (25.1595, 85.9572))
    assert 1.0 < dist < 3.0  # ~1.5 km


def test_intermodal_dispatch_isolation():
    # When V2 (Sultanganj Diara) has road_impact=True, it should ONLY receive boats/rescue teams, NEVER road ambulances
    priorities = [
        {
            "village_id": "V2",
            "priority_score": 0.95,
            "priority_level": "High",
            "population": 7850,
            "road_impact": True,
        },
        {
            "village_id": "V3",
            "priority_score": 0.40,
            "priority_level": "Low",
            "population": 4200,
            "road_impact": False,
        },
    ]

    result = optimize_resources(priorities)
    assert result["status"] == "Optimal"
    allocations = result["allocations"]

    # Verify road ambulance is NOT dispatched to V2
    for alloc in allocations:
        if alloc["resource_type"] == "AMBULANCE":
            assert alloc["village_id"] != "V2"

    # Verify boat coverage contains V2
    assert "V2" in result["boat_coverage"]["served_villages"]
    assert "V2" in result["intermodal_dispatch"]["watercraft_irb_villages"]


def test_unserved_settlements_handling():
    priorities = [
        {"village_id": "V1", "priority_score": 0.90, "priority_level": "Critical", "population": 5420, "road_impact": True},
        {"village_id": "V2", "priority_score": 0.95, "priority_level": "Critical", "population": 7850, "road_impact": True},
        {"village_id": "V3", "priority_score": 0.60, "priority_level": "High", "population": 4200, "road_impact": True},
        {"village_id": "V4", "priority_score": 0.55, "priority_level": "High", "population": 3600, "road_impact": True},
        {"village_id": "V5", "priority_score": 0.50, "priority_level": "Moderate", "population": 4850, "road_impact": True},
    ]
    result = optimize_resources(priorities)
    assert "unserved_settlements" in result
    assert result["unserved_settlements"]["villages"] == ["V3", "V4", "V5"]
    assert len(result["unserved_settlements"]["recommended_actions"]) >= 3
    assert any("IRB" in action for action in result["unserved_settlements"]["recommended_actions"])

