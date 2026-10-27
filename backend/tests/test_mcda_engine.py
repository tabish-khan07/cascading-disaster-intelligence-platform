import pytest
from mcda_engine import calculate_mcda_triage, WEIGHTS, SETTLEMENTS


def test_mcda_weights_sum_to_one():
    total_weight = sum(WEIGHTS.values())
    assert abs(total_weight - 1.0) < 1e-6


def test_mcda_rankings_integrity():
    res = calculate_mcda_triage(
        water_level_m=8.6,
        rainfall_mm=180.0,
        risk_score=0.84,
        affected_roads=["R1"],
        affected_villages=["V1", "V2"],
    )

    rankings = res["settlement_rankings"]
    assert len(rankings) == len(SETTLEMENTS)

    # Check descending order of composite scores
    scores = [r["composite_score"] for r in rankings]
    assert scores == sorted(scores, reverse=True)

    # Sultanganj Diara (V2) must be Rank 1 during river surge
    top_village = rankings[0]
    assert top_village["village_id"] == "V2"
    assert top_village["priority_tier"] == "PRIORITY_1_CRITICAL"
    assert top_village["recommended_directive"] == "MANDATORY_EVACUATION_IRB"
