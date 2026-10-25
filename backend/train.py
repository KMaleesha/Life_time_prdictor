"""FastAPI backend: ML models (RF / XGBoost / LightGBM) run here.

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
Needs the files created by train.py inside backend/artifacts/
"""
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ART = Path(__file__).parent / "artifacts"
MODEL_FILES = {
    "RandomForest": "randomforest_model.joblib",
    "XGBoost": "xgboost_model.joblib",
    "LightGBM": "lightgbm_model.joblib",
}
DISCLAIMER = (
    "Educational demo built on a synthetic dataset. "
    "This is not medical advice and not a real life-expectancy estimate."
)

state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Models එක පාරක් විතරක් load කරනවා (හැම request එකටම නෙවෙයි)."""
    needed = ["schema.json", "metrics.json", "holdout_row.json"]
    missing = [f for f in needed if not (ART / f).exists()]
    if missing:
        raise RuntimeError(f"Missing {missing} in {ART}. Run `python train.py` first.")

    state["schema"] = json.loads((ART / "schema.json").read_text(encoding="utf-8"))
    state["metrics"] = json.loads((ART / "metrics.json").read_text(encoding="utf-8"))
    state["holdout"] = json.loads((ART / "holdout_row.json").read_text(encoding="utf-8"))[0]
    state["models"] = {
        name: joblib.load(ART / fname)
        for name, fname in MODEL_FILES.items()
        if (ART / fname).exists()
    }
    if not state["models"]:
        raise RuntimeError("No model files found. Run `python train.py` first.")
    print("Loaded models:", list(state["models"]))
    yield
    state.clear()


app = FastAPI(title="Sri Lanka Life Expectancy API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    features: dict[str, Any]
    model: Optional[str] = None   # null => best model (lowest RMSE)


def build_row(features: dict[str, Any]) -> pd.DataFrame:
    """Input validate කරලා one-row DataFrame එකක් හදනවා."""
    schema = state["schema"]
    errors: list[str] = []
    row: dict[str, Any] = {}

    for col, spec in schema["numeric"].items():
        if col not in features:
            errors.append(f"{col}: required")
            continue
        try:
            v = float(features[col])
        except (TypeError, ValueError):
            errors.append(f"{col}: must be a number")
            continue
        if not (spec["min"] <= v <= spec["max"]):
            errors.append(f"{col}: must be between {spec['min']:g} and {spec['max']:g}")
            continue
        row[col] = v

    for col, options in schema["categorical"].items():
        if col not in features:
            errors.append(f"{col}: required")
            continue
        v = str(features[col])
        if v not in options:
            errors.append(f"{col}: must be one of {options}")
            continue
        row[col] = v

    if errors:
        raise HTTPException(status_code=422, detail=errors)
    return pd.DataFrame([row])


@app.get("/health")
def health():
    return {"status": "ok", "models": list(state["models"])}


@app.get("/schema")
def get_schema():
    """Form fields (dropdown options, numeric ranges) for the dashboard."""
    return state["schema"]


@app.get("/metrics")
def get_metrics():
    """RF vs XGBoost vs LightGBM metrics + feature importances (from train.py)."""
    return state["metrics"]


@app.get("/holdout")
def get_holdout():
    """Held-out row (never used in training) for the inference demo."""
    target = state["schema"]["target"]
    row = dict(state["holdout"])
    actual = row.pop(target)
    return {"features": row, "actual": round(float(actual), 1)}


@app.post("/predict")
def predict(req: PredictRequest):
    models = state["models"]
    chosen = req.model or state["metrics"].get("best_model") or next(iter(models))
    if chosen not in models:
        raise HTTPException(status_code=400, detail=f"Unknown model '{chosen}'. Use one of {list(models)}")

    df = build_row(req.features)
    all_preds = {name: round(float(m.predict(df)[0]), 1) for name, m in models.items()}
    age = float(df["age"].iloc[0])
    predicted = all_preds[chosen]

    return {
        "model": chosen,
        "predicted_age_of_death": predicted,
        "estimated_remaining_years": round(max(predicted - age, 0.0), 1),
        "all_models": all_preds,
        "disclaimer": DISCLAIMER,
    }
