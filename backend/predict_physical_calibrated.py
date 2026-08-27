from pathlib import Path
import joblib


ROOT = Path(__file__).resolve().parent

MODEL_FILE = (
    ROOT
    / "models"
    / "flood_risk_physical_calibrated.joblib"
)

artifact = joblib.load(MODEL_FILE)

MODEL = artifact["model"]
CALIBRATOR = artifact["calibrator"]
THRESHOLD = float(artifact["threshold"])
FEATURES = artifact["features"]


def predict_flood(
    rainfall_1h_mm: float,
    rainfall_3h_mm: float,
    rainfall_6h_mm: float,
    rainfall_12h_mm: float,
    rainfall_24h_mm: float,
    elevation_m: float,
    slope_deg: float,
    distance_to_river_m: float,
) -> dict:

    values = [
        rainfall_1h_mm,
        rainfall_3h_mm,
        rainfall_6h_mm,
        rainfall_12h_mm,
        rainfall_24h_mm,
        elevation_m,
        slope_deg,
        distance_to_river_m,
    ]

    raw_score = float(
        MODEL.predict_proba([values])[0, 1]
    )

    calibrated_score = float(
        CALIBRATOR.predict([raw_score])[0]
    )

    flood_prediction = int(
        calibrated_score >= THRESHOLD
    )

    return {
        "raw_score": raw_score,
        "calibrated_score": calibrated_score,
        "flood_prediction": flood_prediction,
    }