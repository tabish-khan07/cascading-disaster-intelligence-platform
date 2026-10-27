import pytest
from cascade_engine import calculate_cascade, hospitals, roads, substations, telecom_towers, shelter_facilities


def test_baseline_cascade_zero_risk():
    result = calculate_cascade(0.0)
    assert len(result["affected_roads"]) == 0
    assert len(result["affected_villages"]) == 0
    assert len(result["affected_hospitals"]) == 0
    assert result["population_affected"] == 0
    assert len(result["affected_substations"]) == 0
    assert len(result["affected_telecom"]) == 0


def test_cascade_partial_disruption():
    # Intermediate risk (0.65) should trip low threshold infrastructure
    result = calculate_cascade(0.65)
    assert len(result["affected_roads"]) > 0
    assert len(result["affected_villages"]) > 0
    assert result["population_affected"] > 0
    # Check shelter occupancy calculation
    assert "shelter_status" in result
    assert result["shelter_occupancy_pct"] >= 0.0


def test_catastrophic_cascade_extreme_risk():
    # Extreme risk (0.95) should trip all thresholds
    result = calculate_cascade(0.95)
    assert len(result["affected_roads"]) == len(roads)
    assert len(result["affected_substations"]) == len(substations)
    assert len(result["affected_telecom"]) == len(telecom_towers)
    assert len(result["hospitals_on_backup_power"]) > 0
    assert len(result["villages_comm_blackout"]) > 0


def test_shelter_overflow_when_capacity_exceeded():
    result = calculate_cascade(0.85)
    assert result["shelter_occupancy_pct"] == 100.0
    assert result["shelter_overflow"] is not None
    overflow = result["shelter_overflow"]
    assert overflow["status"] == "CAPACITY_EXCEEDED"
    assert overflow["total_capacity"] == sum(s.capacity for s in shelter_facilities)
    assert overflow["total_occupied"] == overflow["total_capacity"]
    assert overflow["overflow_population"] == result["population_affected"] - overflow["total_capacity"]
    assert len(overflow["recommended_actions"]) == 4

