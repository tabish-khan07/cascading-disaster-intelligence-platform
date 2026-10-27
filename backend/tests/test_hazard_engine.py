import pytest
from hazard_engine import calculate_hazard_score, normalize, analyze_hazard


def test_normalize():
    assert normalize(0.0, 100.0) == 0.0
    assert normalize(50.0, 100.0) == 0.5
    assert normalize(100.0, 100.0) == 1.0
    assert normalize(150.0, 100.0) == 1.0  # Cap at 1.0
    assert normalize(-10.0, 100.0) == 0.0  # Floor at 0.0


def test_calculate_hazard_score_standard():
    score = calculate_hazard_score(rainfall_mm=100.0, duration_hours=3.0, water_level_m=5.0)
    assert 0.0 <= score <= 1.0
    # Rainfall: 100/200 = 0.5; Duration: 3/6 = 0.5; Water: 5/10 = 0.5 -> 0.5*0.5 + 0.2*0.5 + 0.3*0.5 = 0.50
    assert score == 0.50


def test_calculate_hazard_score_with_ml_blend():
    score_no_ml = calculate_hazard_score(rainfall_mm=180.0, duration_hours=4.0, water_level_m=8.6)
    score_with_ml = calculate_hazard_score(rainfall_mm=180.0, duration_hours=4.0, water_level_m=8.6, ml_calibrated_score=0.95)
    assert 0.0 <= score_with_ml <= 1.0
    assert score_with_ml != score_no_ml


def test_analyze_hazard_levels():
    low_hazard = analyze_hazard(rainfall_mm=20.0, duration_hours=1.0, water_level_m=3.0)
    assert low_hazard["hazard_level"] in ("NORMAL", "LOW", "MODERATE")
    assert low_hazard["risk_score"] < 0.50

    extreme_hazard = analyze_hazard(rainfall_mm=240.0, duration_hours=6.0, water_level_m=9.8)
    assert extreme_hazard["hazard_level"] in ("HIGH", "CRITICAL")
    assert extreme_hazard["risk_score"] >= 0.70
