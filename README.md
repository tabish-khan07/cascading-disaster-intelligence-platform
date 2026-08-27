# Cascading Disaster Intelligence & Resource Allocation Platform

**Smart India Hackathon (SIH) 2026**

A full-stack, AI-driven disaster management platform designed to predict, analyze, and optimize responses to cascading disasters (like floods). By utilizing environmental inputs (rainfall, duration, water level) alongside a geographical machine learning model, the platform predicts primary hazard scores, calculates cascading infrastructural impacts, and algorithmically dispatches limited emergency resources to the highest priority areas.

---

## 🎯 Key Features

1. **Hazard Prediction Engine**: Calculates localized risk scores and hazard levels based on physical parameters (Rainfall, Duration, Water Levels) and geospatial ML models.
2. **Cascading Impact Analysis**: Determines the domino effect of a primary disaster on surrounding infrastructure (affected roads, flooded villages, impacted hospitals, and displaced populations).
3. **Automated Priority Ranking**: Ranks affected zones mathematically based on severity of impact, population density, and immediate needs.
4. **Intelligent Resource Optimization**: Leverages `ortools` to optimally allocate available rescue teams and ambulances to prioritized zones, minimizing travel distances and ETA.
5. **Interactive Dashboard**: A Next.js frontend powered by Leaflet to visualize disaster spread, resource dispatch routes, and real-time operational status on an interactive map.

---

## 📁 Project Structure

The repository is structured into two main decoupled services:

* **`/backend`**: The Python FastAPI service and AI/Decision Engine. It contains the ML models, `ortools` resource allocator, and the core `disaster_pipeline.py`.
* **`/frontend`**: The Next.js 16 + React 19 application. Uses TailwindCSS for styling and React-Leaflet for mapping.

---

## 🚀 Installation & Setup

### Prerequisites
* **Node.js** (v18+ recommended) and `npm`
* **Python** (3.10+ recommended) and `pip`

### 1. Backend Setup

The backend handles the AI models and the FastAPI server.

```bash
cd backend

# Install all required Python packages (including ML dependencies)
pip install fastapi uvicorn pydantic pandas joblib xgboost ortools scikit-learn

# Run the development server (runs on port 8000 by default)
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

The frontend is a Next.js application that visualizes the intelligence data.

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Next.js development server (runs on port 3000)
npm run dev
```

---

## 🔌 API Integration Contract

The Next.js frontend communicates with the FastAPI backend primarily via the `/api/disaster/analyze` endpoint.

**POST** `http://localhost:8000/api/disaster/analyze`

**Request Body (JSON):**
```json
{
  "mode": "simulation",
  "rainfall_mm": 180,
  "duration_hours": 4,
  "water_level_m": 8
}
```

**Response (JSON):**
The backend returns a comprehensive payload detailing the cascading effects. Key fields include:
* `status`: Overall operation status (e.g., `RESOURCE_CONSTRAINED`)
* `event`: Baseline hazard severity.
* `impact`: Lists of affected roads, villages, and hospitals.
* `priority_assessment`: Ranked list of zones requiring assistance.
* `resource_optimization`: Algorithmically generated dispatch routes (Resource -> Village mapping with ETA).
* `resource_gaps`: Unserved areas due to resource exhaustion.

---

## ⚠️ Prototype Notes

* **Hazard Weights**: The hazard thresholds and weights used in the decision engine are prototype assumptions designed specifically for the hackathon demo. They are not formally validated disaster-forecasting metrics.
* **Geospatial Data**: Resource locations and village coordinates are currently hardcoded prototype values and should be replaced with live GIS integration in a production environment.
