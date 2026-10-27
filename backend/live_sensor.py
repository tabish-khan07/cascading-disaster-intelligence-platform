"""
live_sensor.py — Real Telemetry Ingestion Engine
=================================================
Fetches live meteorological data from Open-Meteo (https://open-meteo.com/)
for the Barauni/Sultanganj study region (Bihar) and derives flood risk
parameters using physics-informed equations.

API: Open-Meteo (FREE, no API key required)
Lat/Lon: 25.148°N, 85.950°E (Barauni, Begusarai district, Bihar)
"""

import time
import requests
from datetime import datetime, timezone

# Study region centroid — Barauni, Begusarai
STUDY_LAT = 25.148
STUDY_LON = 85.950

# Physics constants for Ganga-Kosi floodplain (Bihar)
# Baseline dry season river stage: ~3.5m MSL
BARRAGE_BASELINE_WATER_LEVEL_M = 3.5
DANGER_LEVEL_M = 8.5                    # CWC danger level
WARNING_LEVEL_M = 7.0                   # CWC warning level

# Rainfall → water-level rise coefficient for this floodplain
RAINFALL_TO_LEVEL_COEFF = 0.022  # m per mm of accumulated rain

WMO_WEATHER_CODES = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rainfall",
    71: "Slight Snow",
    80: "Slight Showers",
    81: "Moderate Showers",
    82: "Violent Rainstorm",
    95: "Thunderstorm",
    96: "Severe Thunderstorm with Hail",
    99: "Heavy Hail Thunderstorm",
}

# Multi-location in-memory cache
_CACHE_STORE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 30


def fetch_live_telemetry(
    lat: float = STUDY_LAT,
    lon: float = STUDY_LON,
    location_name: str = "Barauni-Sultanganj, Begusarai, Bihar",
    cloudburst_offset_mm: float = 0.0,
) -> dict:
    """
    Fetch real-time meteorological data from Open-Meteo for any specified coordinates.
    Supports optional cloudburst stress-testing offset over real baseline conditions.
    """
    cache_key = f"{round(lat, 3)}_{round(lon, 3)}_{round(cloudburst_offset_mm, 1)}"
    now = time.time()

    if cache_key in _CACHE_STORE:
        timestamp, data = _CACHE_STORE[cache_key]
        if (now - timestamp) < _CACHE_TTL_SECONDS:
            return data

    try:
        current_url = "https://api.open-meteo.com/v1/forecast"
        current_params = {
            "latitude": lat,
            "longitude": lon,
            "current": "precipitation,rain,temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
            "timezone": "Asia/Kolkata",
        }
        current_resp = requests.get(current_url, params=current_params, timeout=4.5)
        current_resp.raise_for_status()
        current_data = current_resp.json().get("current", {})

        # Fetch last 6 hours of precipitation
        hourly_params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "precipitation",
            "past_hours": 6,
            "forecast_hours": 0,
            "timezone": "Asia/Kolkata",
        }
        hourly_resp = requests.get(current_url, params=hourly_params, timeout=5.0)
        hourly_resp.raise_for_status()
        hourly = hourly_resp.json().get("hourly", {})
        precip_series = hourly.get("precipitation", [0.0])

        # Raw measured accumulated rainfall over last 6h (mm)
        measured_rain_6h = round(sum(precip_series), 1)
        raw_current_rain = round(current_data.get("precipitation", 0.0), 1)

        # Apply stress-test offset if provided
        total_rain_6h = round(measured_rain_6h + cloudburst_offset_mm, 1)
        effective_current_rain = round(raw_current_rain + (cloudburst_offset_mm * 0.4), 1)

        # Duration estimation
        rainy_hours = sum(1 for p in precip_series if p > 0.1)
        if cloudburst_offset_mm > 0:
            rainy_hours = max(rainy_hours, 2)
        duration_hours = max(rainy_hours, 1) if total_rain_6h > 0 else 1.0

        # Physics-based river water level derivation
        derived_water_level = round(
            BARRAGE_BASELINE_WATER_LEVEL_M + (total_rain_6h * RAINFALL_TO_LEVEL_COEFF),
            2
        )
        humidity = current_data.get("relative_humidity_2m", 60)
        if humidity > 80:
            derived_water_level += 0.5
        derived_water_level = round(min(derived_water_level, 12.0), 2)

        # CWC Flood alert tier
        if derived_water_level >= DANGER_LEVEL_M:
            alert_level = "DANGER"
        elif derived_water_level >= WARNING_LEVEL_M:
            alert_level = "WARNING"
        else:
            alert_level = "NORMAL"

        weather_code = current_data.get("weather_code", 0)
        weather_desc = WMO_WEATHER_CODES.get(weather_code, "Partly Cloudy")

        payload = {
            "data_source": "open-meteo-live",
            "source_label": "Open-Meteo API (Real IMD-calibrated NWP Stream)",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "study_region": location_name,
            "coordinates": {"lat": lat, "lon": lon},
            "rainfall_mm": total_rain_6h,
            "duration_hours": float(duration_hours),
            "water_level_m": derived_water_level,
            "cloudburst_offset_applied_mm": cloudburst_offset_mm,
            "sensor_readings": {
                "current_rain_mm_per_hr": effective_current_rain,
                "measured_rain_6h_mm": measured_rain_6h,
                "accumulated_rain_6h_mm": total_rain_6h,
                "temperature_c": current_data.get("temperature_2m"),
                "humidity_pct": humidity,
                "wind_speed_kmh": current_data.get("wind_speed_10m"),
                "weather_code": weather_code,
                "weather_description": weather_desc,
            },
            "barrage_status": {
                "estimated_level_m": derived_water_level,
                "danger_level_m": DANGER_LEVEL_M,
                "warning_level_m": WARNING_LEVEL_M,
                "alert_level": alert_level,
            },
            "is_live": True,
        }
        _CACHE_STORE[cache_key] = (now, payload)
        return payload

    except Exception as exc:
        fallback_total_rain = round(180.0 + cloudburst_offset_mm, 1)
        fallback_payload = {
            "data_source": "fallback-demo",
            "source_label": "Demo Mode (Satellite API offline fallback)",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "study_region": location_name,
            "coordinates": {"lat": lat, "lon": lon},
            "rainfall_mm": fallback_total_rain,
            "duration_hours": 4.0,
            "water_level_m": 8.0,
            "cloudburst_offset_applied_mm": cloudburst_offset_mm,
            "sensor_readings": {
                "current_rain_mm_per_hr": 22.5,
                "measured_rain_6h_mm": 180.0,
                "accumulated_rain_6h_mm": fallback_total_rain,
                "temperature_c": 27.0,
                "humidity_pct": 95,
                "wind_speed_kmh": 14.0,
                "weather_code": 65,
                "weather_description": "Heavy Monsoon Precipitation",
            },
            "barrage_status": {
                "estimated_level_m": 8.0,
                "danger_level_m": DANGER_LEVEL_M,
                "warning_level_m": WARNING_LEVEL_M,
                "alert_level": "DANGER",
            },
            "is_live": False,
            "fallback_reason": str(exc),
        }
        _CACHE_STORE[cache_key] = (now, fallback_payload)
        return fallback_payload
