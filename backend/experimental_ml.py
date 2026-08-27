from ml_feature_mapper import get_ml_features
from predict_physical_calibrated import predict_flood


def predict_experimental(
    latitude: float,
    longitude: float,
) -> dict:

    features = get_ml_features(
        latitude=latitude,
        longitude=longitude,
    )

    result = predict_flood(
        rainfall_1h_mm=features["rainfall_1h_mm"],
        rainfall_3h_mm=features["rainfall_3h_mm"],
        rainfall_6h_mm=features["rainfall_6h_mm"],
        rainfall_12h_mm=features["rainfall_12h_mm"],
        rainfall_24h_mm=features["rainfall_24h_mm"],
        elevation_m=features["elevation_m"],
        slope_deg=features["slope_deg"],
        distance_to_river_m=features["distance_to_river_m"],
    )

    return {
        "status": "experimental",
        "latitude": latitude,
        "longitude": longitude,
        "raw_score": round(
            result["raw_score"], 6
        ),
        "calibrated_score": round(
            result["calibrated_score"], 6
        ),
        "flood_prediction": int(
            result["flood_prediction"]
        ),
        "model_type": "XGBoost",
        "calibration": "isotonic",
        "deployment_ready": False,
        "features_used": features,
        "note": (
            "Experimental validation model. "
            "Calibration and threshold were frozen "
            "from the validation procedure. "
            "2024 evaluation remains frozen."
        ),
    }