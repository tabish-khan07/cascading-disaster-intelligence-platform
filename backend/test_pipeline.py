from disaster_pipeline import run_disaster_pipeline


def main():
    result = run_disaster_pipeline(
        rainfall_mm=180,
        duration_hours=4,
        water_level_m=8,
    )

    assert "status" in result
    assert "event" in result
    assert "impact" in result
    assert "priority_assessment" in result
    assert "resource_optimization" in result
    assert "resource_gaps" in result

    assert 0.0 <= result["event"]["risk_score"] <= 1.0
    assert isinstance(result["impact"]["affected_villages"], list)

    print("Pipeline integration test: PASS")
    print("Status:", result["status"])
    print("Risk:", result["event"]["risk_score"])
    print("Population affected:", result["impact"]["population_affected"])
    print("Rescue gaps:", result["resource_gaps"]["rescue_teams"])


if __name__ == "__main__":
    main()
