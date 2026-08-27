from ml_feature_mapper import get_ml_features


features = get_ml_features(
    latitude=25.15,
    longitude=85.95,
)

print("\nMAPPED FEATURES\n")

for key, value in features.items():
    print(f"{key}: {value}")