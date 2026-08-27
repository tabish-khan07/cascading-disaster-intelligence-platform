import joblib
import pandas as pd
from pathlib import Path


MODEL_PATH = (
    Path(__file__).resolve().parent
    / "models"
    / "flood_risk_physical_model.joblib"
)


positive_rows = [
    [25.15, 85.95, 0.740, 3.160, 4.635, 7.340, 9.875, 44.0, 0.024709, 723.042626],
    [25.15, 86.75, 2.055, 8.770, 13.305, 24.170, 35.965, 40.0, 0.023126, 678.523475],
    [25.15, 86.85, 1.480, 5.320, 8.430, 20.165, 31.100, 41.0, 0.074128, 534.288239],
    [25.15, 87.049995, 1.370, 3.360, 4.925, 18.705, 28.700, 37.0, 0.039550, 1241.040745],
    [25.15, 87.15, 0.970, 2.370, 3.470, 17.365, 26.855, 34.0, 0.057718, 239.887608],
    [25.25, 85.75, 1.000, 4.235, 7.135, 8.945, 11.970, 47.0, 0.039550, 891.301277],
    [25.25, 85.85, 0.475, 3.835, 5.870, 8.215, 10.975, 43.0, 0.030882, 716.301605],
    [25.25, 85.95, 0.495, 4.235, 6.130, 9.105, 12.025, 43.0, 0.011563, 960.119499],
    [25.25, 86.049995, 0.775, 4.735, 6.485, 9.535, 12.930, 45.0, 0.095004, 2096.251829],
    [25.25, 86.15, 1.910, 6.280, 9.775, 13.000, 17.770, 44.0, 0.024709, 762.512110],
]

negative_rows = [
    [24.05, 83.049995, 0.000, 0.000, 0.200, 8.370, 11.365, 367.0, 0.506777, 1095.926555],
    [24.05, 83.15, 0.000, 0.000, 0.175, 4.455, 7.225, 357.0, 0.764324, 1012.800708],
    [24.05, 83.25, 0.000, 0.000, 0.150, 5.025, 7.870, 301.0, 1.489077, 1177.438657],
    [24.05, 83.35, 0.000, 0.105, 0.350, 8.230, 11.220, 313.0, 0.686817, 1671.395038],
    [24.05, 83.45, 0.000, 1.095, 10.800, 14.500, 335.0, 1.238940, 492.086547],
    [24.05, 83.549995, 0.105, 0.250, 2.380, 10.685, 14.880, 383.0, 0.469464, 2343.422869],
    [24.05, 83.65, 0.155, 0.315, 6.760, 16.470, 20.410, 340.0, 2.132588, 2685.063469],
    [24.05, 83.75, 0.175, 0.720, 13.265, 23.685, 27.130, 278.0, 0.286818, 811.908963],
    [24.05, 83.85, 0.230, 1.000, 10.555, 21.920, 24.690, 257.0, 0.575716, 778.676086],
    [24.05, 83.95, 0.175, 1.415, 11.250, 24.325, 27.015, 217.0, 0.105947, 334.782918],
]

columns = [
    "latitude",
    "longitude",
    "rainfall_1h_mm",
    "rainfall_3h_mm",
    "rainfall_6h_mm",
    "rainfall_12h_mm",
    "rainfall_24h_mm",
    "elevation_m",
    "slope_deg",
    "distance_to_river_m",
]

model_artifact = joblib.load(MODEL_PATH)
model = model_artifact["model"]
features = model_artifact["features"]

positive_df = pd.DataFrame(positive_rows, columns=columns)
negative_df = pd.DataFrame(negative_rows, columns=columns)

positive_X = positive_df[features]
negative_X = negative_df[features]

positive_scores = model.predict_proba(positive_X)[:, 1]
negative_scores = model.predict_proba(negative_X)[:, 1]

print("\n========== EXPERIMENTAL ML BATCH TEST ==========\n")

print("POSITIVE ROW SCORES")
for i, score in enumerate(positive_scores, start=1):
    print(f"Positive {i:02d}: {score:.8f}")

print("\nNEGATIVE ROW SCORES")
for i, score in enumerate(negative_scores, start=1):
    print(f"Negative {i:02d}: {score:.8f}")

print("\n========== SUMMARY ==========")

print(
    f"\nPositive mean:   {positive_scores.mean():.8f}"
    f"\nPositive median: {pd.Series(positive_scores).median():.8f}"
    f"\nPositive min:    {positive_scores.min():.8f}"
    f"\nPositive max:    {positive_scores.max():.8f}"
)

print(
    f"\nNegative mean:   {negative_scores.mean():.8f}"
    f"\nNegative median: {pd.Series(negative_scores).median():.8f}"
    f"\nNegative min:    {negative_scores.min():.8f}"
    f"\nNegative max:    {negative_scores.max():.8f}"
)

print(
    "\nPositive > Negative mean:",
    positive_scores.mean() > negative_scores.mean()
)

print(
    "Positive max > Negative max:",
    positive_scores.max() > negative_scores.max()
)

print(
    "\nThreshold separation check:"
)

for threshold in [0.0001, 0.0003, 0.0005, 0.001]:
    pos_detected = (positive_scores >= threshold).sum()
    neg_detected = (negative_scores >= threshold).sum()

    print(
        f"Threshold {threshold:.4f} -> "
        f"positive detected: {pos_detected}/10, "
        f"negative flagged: {neg_detected}/10"
    )