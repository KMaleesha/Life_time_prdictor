"""FastAPI backend serving the trained models.

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
Needs backend/artifacts/ from train.py.
"""
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ART = Path(__file__).parent / "artifacts"
MODEL_FILES = {
    "EBM": "ebm_model.joblib",
    "RandomForest": "randomforest_model.joblib",
    "LightGBM": "lightgbm_model.joblib",
}
DISCLAIMER = (
    "Educational demo built on a synthetic dataset. "
    "This is not medical advice and not a real life-expectancy estimate."
)
ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
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


app = FastAPI(title="Sri Lanka Life Expectancy API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    features: dict[str, Any]
    model: Optional[str] = None  # None = primary model (EBM)


def build_row(features: dict[str, Any]) -> pd.DataFrame:
    """Validate input and build a one-row DataFrame."""
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
    # same column order as training
    return pd.DataFrame([row])[schema["feature_order"]]


def explain_ebm(df: pd.DataFrame, top: int = 8) -> Optional[dict]:
    """Exact additive contributions of each EBM term (in years)."""
    ebm = state["models"].get("EBM")
    if ebm is None:
        return None
    contrib = np.asarray(ebm.eval_terms(df))[0]
    names = list(ebm.term_names_)
    order = np.argsort(-np.abs(contrib))[:top]
    items = []
    for i in order:
        shown = " | ".join(str(df[p].iloc[0]) for p in names[i].split(" & ") if p in df.columns)
        items.append({"term": names[i], "input": shown, "value": round(float(contrib[i]), 3)})
    return {
        "intercept": round(float(np.ravel(ebm.intercept_)[0]), 2),
        "contributions": items,
        "other": round(float(contrib.sum() - contrib[order].sum()), 3),
    }


@app.get("/health")
def health():
    return {"status": "ok", "models": list(state["models"])}


@app.get("/schema")
def get_schema():
    return state["schema"]


@app.get("/metrics")
def get_metrics():
    """Metrics, importances, partial dependence and fairness tables."""
    return state["metrics"]


@app.get("/holdout")
def get_holdout():
    target = state["schema"]["target"]
    row = dict(state["holdout"])
    actual = row.pop(target)
    return {"features": row, "actual": round(float(actual), 1)}


@app.post("/predict")
def predict(req: PredictRequest):
    models = state["models"]
    chosen = req.model or state["metrics"].get("primary_model") or next(iter(models))
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
        "explanation": explain_ebm(df),
        "disclaimer": DISCLAIMER,
    }