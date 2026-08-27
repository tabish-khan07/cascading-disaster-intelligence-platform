# SIH 2026 — AI / Decision Engine Package

Cascading Disaster Intelligence & Resource Allocation Platform

## Ownership

This package is the Person 2 AI/decision layer.

It contains:
- `hazard_engine.py` — converts rainfall duration/water level into a prototype hazard score
- `cascade_engine.py` — determines affected roads, villages, hospitals and population
- `priority_engine.py` — ranks affected villages
- `resource_optimizer.py` — assigns ambulances/rescue teams using priority + distance/ETA
- `disaster_pipeline.py` — single entry point used by the backend

## Integration rule

Backend should call ONLY:

```python
from disaster_pipeline import run_disaster_pipeline

result = run_disaster_pipeline(
    rainfall_mm=180,
    duration_hours=4,
    water_level_m=8
)
```

Do not import internal engines directly into the frontend.

Recommended architecture:

Frontend
  -> Backend API
      -> disaster_pipeline.py
          -> hazard_engine.py
          -> cascade_engine.py
          -> priority_engine.py
          -> resource_optimizer.py
      -> JSON response
  -> Frontend dashboard

## Input contract

```json
{
  "rainfall_mm": 180,
  "duration_hours": 4,
  "water_level_m": 8
}
```

## Output contract (top level)

```text
status
event
impact
priority_assessment
resource_optimization
resource_gaps
```

The output uses snake_case. Keep field names stable during integration.

## Backend API recommendation

The backend can expose:

POST /api/disaster/analyze

Request:
```json
{
  "rainfall_mm": 180,
  "duration_hours": 4,
  "water_level_m": 8
}
```

Response:
Return the full result from `run_disaster_pipeline(...)`.

## Run locally

From this folder:

```bash
python disaster_pipeline.py
```

Expected demo state for the default extreme scenario:
- risk score is calculated from the inputs
- cascade analysis identifies affected assets
- priority ranking is generated
- ambulance/rescue allocation is generated
- resource gaps are reported

## Important prototype note

The hazard weights and thresholds are prototype assumptions for the hackathon demo; they are not validated disaster-forecasting parameters.

Resource locations and village coordinates in `resource_optimizer.py` are also prototype values and should be replaced with agreed demo/GIS data later.

## Freeze rule

Treat `disaster_pipeline.py` and its JSON field names as the integration contract. Coordinate any field-name changes with the backend/frontend owner.
