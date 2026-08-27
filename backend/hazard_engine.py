def normalize(value: float, maximum: float) -> float:
    """Normalize a value to the 0-1 range."""
    if maximum <= 0:
        raise ValueError("Maximum must be greater than zero.")
    return max(0.0, min(value / maximum, 1.0))


def calculate_hazard_score(
    rainfall_mm: float,
    duration_hours: float,
    water_level_m: float,
) -> float:
    """
    Prototype hazard score:
      - rainfall: 50%
      - duration: 20%
      - water level: 30%
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

    hazard_score = (
        0.50 * rainfall_score
        + 0.20 * duration_score
        + 0.30 * water_level_score
    )

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
) -> dict:
    risk_score = calculate_hazard_score(
        rainfall_mm=rainfall_mm,
        duration_hours=duration_hours,
        water_level_m=water_level_m,
    )
    return {
        "type": "EXTREME_RAINFALL",
        "risk_score": risk_score,
        "hazard_level": classify_hazard(risk_score),
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
    }

    print("\n========== HAZARD ENGINE TEST ==========")
    for name, values in scenarios.items():
        result = analyze_hazard(**values)
        print(f"\n{name}")
        print("Risk Score:", result["risk_score"])
        print("Hazard Level:", result["hazard_level"])
