"""
Authoritative Single Source of Truth for Settlement Demographics and Spatial Profiles
Sector: Barauni – Sultanganj Diara River Basin (Begusarai District, Bihar)
Standard: Census of India / SEOC Verified Basin GIS Register
"""

from typing import Dict, Any

# Single authoritative dictionary for all settlements in the sector
SETTLEMENTS: Dict[str, Dict[str, Any]] = {
    "V1": {
        "id": "V1",
        "name": "Pipra Dewas",
        "population": 5420,
        "lat": 25.1480,
        "lon": 85.9428,
        "elevation_m": 41.5,
        "shelter_distance_km": 2.2,
        "elderly_pct": 14.0,
        "children_pct": 22.0,
        "type": "Diara Riparian Panchayat",
        "road_id": "R1",
    },
    "V2": {
        "id": "V2",
        "name": "Sultanganj Diara",
        "population": 7850,
        "lat": 25.1595,
        "lon": 85.9572,
        "elevation_m": 39.2,
        "shelter_distance_km": 4.8,
        "elderly_pct": 18.0,
        "children_pct": 26.0,
        "type": "Island Settlement",
        "road_id": "R2",
    },
    "V3": {
        "id": "V3",
        "name": "Mirzapur Bandh",
        "population": 4200,
        "lat": 25.1370,
        "lon": 85.9515,
        "elevation_m": 43.1,
        "shelter_distance_km": 1.8,
        "elderly_pct": 11.0,
        "children_pct": 18.0,
        "type": "Wetland Basin Panchayat",
        "road_id": "R3",
    },
    "V4": {
        "id": "V4",
        "name": "Simaria Ghat North",
        "population": 3600,
        "lat": 25.1495,
        "lon": 85.9395,
        "elevation_m": 42.0,
        "shelter_distance_km": 3.1,
        "elderly_pct": 12.0,
        "children_pct": 19.0,
        "type": "Riparian Wetland Panchayat",
        "road_id": "R4",
    },
    "V5": {
        "id": "V5",
        "name": "Rajendra Bridge Approach",
        "population": 4850,
        "lat": 25.1480,
        "lon": 85.9580,
        "elevation_m": 44.5,
        "shelter_distance_km": 1.2,
        "elderly_pct": 9.0,
        "children_pct": 15.0,
        "type": "Riverfront Diara Settlement",
        "road_id": "R5",
    },
}

# Derived quick lookup mappings
VILLAGE_NAMES: Dict[str, str] = {vid: meta["name"] for vid, meta in SETTLEMENTS.items()}
VILLAGE_POPULATIONS: Dict[str, int] = {vid: meta["population"] for vid, meta in SETTLEMENTS.items()}
VILLAGE_LOCATIONS: Dict[str, tuple] = {vid: (meta["lat"], meta["lon"]) for vid, meta in SETTLEMENTS.items()}

# Total basin population (Sum of all 5 settlements = 25,920)
TOTAL_SECTOR_POPULATION: int = sum(VILLAGE_POPULATIONS.values())
