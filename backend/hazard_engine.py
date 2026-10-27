def normalize(value: float, maximum: float) -> float:
    """Normalize a value to the 0-1 range."""
    if maximum <= 0:
        raise ValueError("Maximum must be greater than zero.")
    return max(0.0, min(value / maximum, 1.0))


def calculate_hazard_score(
    rainfall_mm: float,
    duration_hours: float,
    water_level_m: float,
    ml_calibrated_score: float | None = None,
) -> float:
    """
    Prototype hazard score:
      - rainfall: 50%
      - duration: 20%
      - water level: 30%
    If ml_calibrated_score is provided:
      - ml_calibrated_score: 40%
      - rainfall: 25%
      - duration: 10%
      - water level: 25%
    """
    if rainfall_mm < 0:
        raise ValueError("Rainfall cannot be negative.")
    if duration_hours < 0:
        raise ValueError("Duration cannot be negative.")
    if water_level_m < 0:
        raise ValueError("Water level cannot be negative.")

    rainfall_score = normalize(rainfall_mm, 200.0)
    duration_score = normalize(duration_hours, 6.0)
    water_level_score = normalize(water_level_m, 10.0)

    base_hazard = (
        0.50 * rainfall_score
        + 0.20 * duration_score
        + 0.30 * water_level_score
    )

    if ml_calibrated_score is not None:
        # The calibrated score is produced by Isotonic Regression trained on rare inundation events.
        # Its operational decision threshold is 0.012658.
        # Excess probability scales above the threshold up to max observed calibrated score (~0.20-0.50).
        ml_excess = max(0.0, ml_calibrated_score - 0.012658)
        ml_signal = min(1.0, ml_excess / 0.05)

        # In baseline patrol conditions (<60mm rain and <5.0m river water level),
        # keep risk well below the first road severance threshold (0.35)
        if rainfall_mm < 60 and water_level_m < 5.0:
            hazard_score = base_hazard * 0.85
        else:
            hazard_score = 0.80 * base_hazard + 0.20 * max(base_hazard, ml_signal)
    else:
        hazard_score = base_hazard

    return round(max(0.0, min(hazard_score, 1.0)), 2)


def classify_hazard(risk_score: float) -> str:
    if risk_score < 0.30:
        return "LOW"
    if risk_score < 0.50:
        return "MODERATE"
    if risk_score < 0.75:
        return "HIGH"
    return "CRITICAL"


def analyze_hazard(
    rainfall_mm: float,
    duration_hours: float,
    water_level_m: float,
    ml_calibrated_score: float | None = None,
    decision_threshold: float = 0.012658,
    above_threshold: bool | None = None,
    ml_status: str | None = None,
    model_behaviour: str = "HIGH_RECALL_LOW_PRECISION (early-warning mode)",
) -> dict:
    risk_score = calculate_hazard_score(
        rainfall_mm=rainfall_mm,
        duration_hours=duration_hours,
        water_level_m=water_level_m,
        ml_calibrated_score=ml_calibrated_score,
    )

    if ml_calibrated_score is not None:
        if above_threshold is None:
            above_threshold = bool(ml_calibrated_score >= decision_threshold)
        if ml_status is None:
            ml_status = (
                "ABOVE_EARLY_WARNING_THRESHOLD (high-sensitivity mode)"
                if above_threshold
                else "BELOW_THRESHOLD"
            )
    else:
        if above_threshold is None:
            above_threshold = False
        if ml_status is None:
            ml_status = "BELOW_THRESHOLD"

    return {
        "type": "EXTREME_RAINFALL",
        "risk_score": risk_score,
        "hazard_level": classify_hazard(risk_score),
        "ml_backed": ml_calibrated_score is not None,
        "ml_calibrated_score": ml_calibrated_score,
        "decision_threshold": decision_threshold,
        "above_threshold": above_threshold,
        "ml_status": ml_status,
        "model_behaviour": model_behaviour,
        "inputs": {
            "rainfall_mm": rainfall_mm,
            "duration_hours": duration_hours,
            "water_level_m": water_level_m,
        },
    }


if __name__ == "__main__":
    scenarios = {
        "MODERATE": {"rainfall_mm": 40, "duration_hours": 1, "water_level_m": 2},
        "HEAVY": {"rainfall_mm": 120, "duration_hours": 3, "water_level_m": 5},
        "EXTREME": {"rainfall_mm": 180, "duration_hours": 4, "water_level_m": 8},
        "ML_CALIBRATED": {"rainfall_mm": 180, "duration_hours": 4, "water_level_m": 8, "ml_calibrated_score": 0.85},
    }

    print("\n========== HAZARD ENGINE TEST ==========")
    for name, values in scenarios.items():
        result = analyze_hazard(**values)
        print(f"\n{name}")
        print("Risk Score:", result["risk_score"])
        print("Hazard Level:", result["hazard_level"])
        print("ML Backed:", result["ml_backed"])
        print("ML Score:", result["ml_calibrated_score"])
