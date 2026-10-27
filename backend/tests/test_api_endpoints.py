import pytest


def test_home_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert "POST /api/disaster/analyze" in data["endpoints"]
    assert "POST /api/mcda/triage" in data["endpoints"]
    assert "GET /api/cap/feed.xml" in data["endpoints"]


def test_disaster_simulation_endpoint(client):
    payload = {
        "mode": "simulation",
        "rainfall_mm": 180,
        "duration_hours": 4,
        "water_level_m": 8.6,
    }
    response = client.post("/api/disaster/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("RESOURCE_CONSTRAINED", "OPTIMAL", "FULLY_COVERED")
    assert "data_freshness" in data
    assert "generated_at" in data["data_freshness"]
    assert isinstance(data["data_freshness"]["age_seconds"], int)
    assert "source" in data["data_freshness"]

    # Hardened Event object
    assert "event" in data
    assert isinstance(data["event"]["risk_score"], (float, int))
    assert data["event"]["hazard_level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")
    assert isinstance(data["event"]["ml_calibrated_score"], float)
    assert data["event"]["decision_threshold"] == 0.012658
    assert isinstance(data["event"]["above_threshold"], bool)
    assert "ABOVE_EARLY_WARNING_THRESHOLD" in data["event"]["ml_status"] or "BELOW_THRESHOLD" in data["event"]["ml_status"]
    assert data["event"]["model_behaviour"] == "HIGH_RECALL_LOW_PRECISION (early-warning mode)"

    # Hardened unserved_settlements block
    assert "resource_optimization" in data
    assert "unserved_settlements" in data["resource_optimization"]
    assert isinstance(data["resource_optimization"]["unserved_settlements"]["villages"], list)
    assert isinstance(data["resource_optimization"]["unserved_settlements"]["recommended_actions"], list)

    # Hardened shelter_overflow block when full
    assert "shelter_overflow" in data["cascade_utilities"] or "shelter_overflow" in data["resource_optimization"]
    overflow_block = data["cascade_utilities"].get("shelter_overflow") or data["resource_optimization"].get("shelter_overflow")
    assert overflow_block["status"] == "CAPACITY_EXCEEDED"
    assert overflow_block["total_capacity"] == 1450
    assert overflow_block["total_occupied"] == 1450
    assert overflow_block["overflow_population"] == 24470

    # Consistent population numbers across sections
    from settlements import SETTLEMENTS
    assert data["impact"]["population_affected"] == sum(s["population"] for s in SETTLEMENTS.values())
    for ranking in data["mcda_triage"]["settlement_rankings"]:
        vid = ranking["village_id"]
        assert ranking["population"] == SETTLEMENTS[vid]["population"]
    for alloc in data["resource_optimization"]["allocations"]:
        vid = alloc["village_id"]
        assert alloc["population"] == SETTLEMENTS[vid]["population"]


def test_mcda_endpoint(client):
    payload = {
        "water_level_m": 8.5,
        "rainfall_mm": 180.0,
        "risk_score": 0.82,
        "affected_roads": ["R1"],
        "affected_villages": ["V1", "V2"],
    }
    response = client.post("/api/mcda/triage", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "settlement_rankings" in data
    assert len(data["settlement_rankings"]) == 5
    assert data["settlement_rankings"][0]["village_id"] == "V2"


def test_cap_feed_endpoint(client):
    response = client.get("/api/cap/feed.xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    assert "<alert xmlns=\"urn:oasis:names:tc:emergency:cap:1.2\">" in response.text
    assert "<headline>" in response.text


def test_sar_calibrate_endpoint(client):
    payload = {
        "threshold_db": -18.5,
        "polarization": "VV",
        "filter_type": "LEE_3X3",
        "total_area_km2": 16.20,
    }
    response = client.post("/api/sar/calibrate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "calibrated_water_area_km2" in data
    assert data["calibrated_water_area_km2"] > 0.0
    assert data["polarization"] == "VV"


def test_comms_directory_and_ping(client):
    dir_res = client.get("/api/comms/directory")
    assert dir_res.status_code == 200
    dir_data = dir_res.json()
    assert len(dir_data["channels"]) == 6

    ping_res = client.post("/api/comms/ping")
    assert ping_res.status_code == 200
    ping_data = ping_res.json()
    assert ping_data["status"] == "ALL_CHANNELS_ACKNOWLEDGED"
