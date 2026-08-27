from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent

RAIN_PHYSICAL_FILE = (
    BASE_DIR
    / "data"
    / "processed"
    / "final_flood_training.csv"
)

PHYSICAL_FILE = (
    BASE_DIR
    / "data"
    / "processed"
    / "bihar_physical_features.csv"
)


REQUIRED_RAINFALL_FEATURES = [
    "rainfall_1h_mm",
    "rainfall_3h_mm",
    "rainfall_6h_mm",
    "rainfall_12h_mm",
    "rainfall_24h_mm",
]

REQUIRED_PHYSICAL_FEATURES = [
    "elevation_m",
    "slope_deg",
    "distance_to_river_m",
]


_rainfall_df = None
_physical_df = None


def load_feature_data():
    global _rainfall_df
    global _physical_df

    if _rainfall_df is None:
        if not RAIN_PHYSICAL_FILE.exists():
            raise FileNotFoundError(
                f"Rainfall dataset not found: {RAIN_PHYSICAL_FILE}"
            )

        _rainfall_df = pd.read_csv(RAIN_PHYSICAL_FILE)

    if _physical_df is None:
        if not PHYSICAL_FILE.exists():
            raise FileNotFoundError(
                f"Physical dataset not found: {PHYSICAL_FILE}"
            )

        _physical_df = pd.read_csv(PHYSICAL_FILE)

    return _rainfall_df, _physical_df


def get_ml_features(
    latitude: float,
    longitude: float,
) -> dict:

    rainfall_df, physical_df = load_feature_data()

    required_columns = (
        ["latitude", "longitude"]
        + REQUIRED_RAINFALL_FEATURES
    )

    missing_rainfall_columns = [
        column
        for column in required_columns
        if column not in rainfall_df.columns
    ]

    if missing_rainfall_columns:
        raise ValueError(
            "Missing columns in final_flood_training.csv: "
            f"{missing_rainfall_columns}"
        )

    required_physical_columns = (
        ["latitude", "longitude"]
        + REQUIRED_PHYSICAL_FEATURES
    )

    missing_physical_columns = [
        column
        for column in required_physical_columns
        if column not in physical_df.columns
    ]

    if missing_physical_columns:
        raise ValueError(
            "Missing columns in bihar_physical_features.csv: "
            f"{missing_physical_columns}"
        )

    # Match the rainfall row using latitude + longitude.
    rainfall_match = rainfall_df[
        (rainfall_df["latitude"] == latitude)
        & (rainfall_df["longitude"] == longitude)
    ]

    if rainfall_match.empty:
        raise ValueError(
            f"No rainfall feature row found for "
            f"latitude={latitude}, longitude={longitude}"
        )

    # Match the physical row using latitude + longitude.
    physical_match = physical_df[
        (physical_df["latitude"] == latitude)
        & (physical_df["longitude"] == longitude)
    ]

    if physical_match.empty:
        raise ValueError(
            f"No physical feature row found for "
            f"latitude={latitude}, longitude={longitude}"
        )

    if len(physical_match) > 1:
        raise ValueError(
            f"Multiple physical rows found for "
            f"latitude={latitude}, longitude={longitude}"
        )

    rainfall_row = rainfall_match.iloc[0]
    physical_row = physical_match.iloc[0]

    return {
        "rainfall_1h_mm": float(
            rainfall_row["rainfall_1h_mm"]
        ),
        "rainfall_3h_mm": float(
            rainfall_row["rainfall_3h_mm"]
        ),
        "rainfall_6h_mm": float(
            rainfall_row["rainfall_6h_mm"]
        ),
        "rainfall_12h_mm": float(
            rainfall_row["rainfall_12h_mm"]
        ),
        "rainfall_24h_mm": float(
            rainfall_row["rainfall_24h_mm"]
        ),
        "elevation_m": float(
            physical_row["elevation_m"]
        ),
        "slope_deg": float(
            physical_row["slope_deg"]
        ),
        "distance_to_river_m": float(
            physical_row["distance_to_river_m"]
        ),
    }