from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

from experimental_ml import predict_experimental
from disaster_pipeline import run_disaster_pipeline


class DisasterInput(BaseModel):
    mode: Literal["live", "simulation"] = "simulation"

    rainfall_mm: float | None = Field(default=None, ge=0)
    duration_hours: float | None = Field(default=None, ge=0)
    water_level_m: float | None = Field(default=None, ge=0)


app = FastAPI(
    title="Cascading Disaster Intelligence Platform"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Disaster Intelligence API is running"
    }


@app.post("/api/disaster/analyze")
def analyze_disaster(data: DisasterInput):

    # SIMULATION MODE
    if data.mode == "simulation":

        if (
            data.rainfall_mm is None
            or data.duration_hours is None
            or data.water_level_m is None
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Simulation mode requires "
                    "rainfall, duration and water level."
                )
            )

        return run_disaster_pipeline(
            rainfall_mm=data.rainfall_mm,
            duration_hours=data.duration_hours,
            water_level_m=data.water_level_m,
        )

    # LIVE MODE - temporary fallback
    return run_disaster_pipeline(
        rainfall_mm=180,
        duration_hours=4,
        water_level_m=8,
    )


@app.post("/api/ml/experimental")
def experimental_ml_prediction(
    latitude: float,
    longitude: float,
):
    try:
        return predict_experimental(
            latitude=latitude,
            longitude=longitude,
        )

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Experimental ML error: {error}",
        )