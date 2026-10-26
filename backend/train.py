import glob
import json
import os
import time
from pathlib import Path

import joblib
import kagglehub
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

RANDOM_STATE = 42
SAMPLE_SIZE = 150_000
TARGET = "simulated_age_of_death"
OUT = Path(__file__).parent / "artifacts"
OUT.mkdir(exist_ok=True)

# 1. Download and load
path = kagglehub.dataset_download("bawanthabeliwaththa/sri-lankan-health-data-from-various-factors")
csv_files = glob.glob(os.path.join(path, "**", "*.csv"), recursive=True)
csv_path = next(f for f in csv_files if "synthetic_sri_lanka_health_cohort" in os.path.basename(f))
print("Loading:", csv_path)

# keep "None" as a category, not NaN
df = pd.read_csv(csv_path, keep_default_na=False, na_values=[""])
print("Full shape:", df.shape)
df = df.sample(SAMPLE_SIZE, random_state=RANDOM_STATE).reset_index(drop=True)

# 2. Drop unused and leakage columns
DROP = [
    "record_id",
    "age_group", "district_zone", "bmi",  # duplicates
    "baseline_remaining_le", "total_deductions", "predicted_lifespan",  # leakage
    "ten_yr_mortality_risk", "survival_prob_age75",
]
df = df.drop(columns=DROP)
print("Missing values:", int(df.isna().sum().sum()), "| Duplicates:", int(df.duplicated().sum()))

# 3. Hold out one row for inference
holdout = df.sample(1, random_state=RANDOM_STATE)
df = df.drop(holdout.index)
holdout.to_json(OUT / "holdout_row.json", orient="records", indent=2)
print("Holdout actual age of death:", float(holdout[TARGET].iloc[0]))

# 4. Features and target
X = df.drop(columns=TARGET)
y = df[TARGET]
num_cols = X.select_dtypes(include="number").columns.tolist()
cat_cols = X.select_dtypes(exclude="number").columns.tolist()
print("Numeric:", num_cols)
print("Categorical:", cat_cols)

# form schema for the dashboard
schema = {
    "numeric": {c: {"min": float(X[c].min()), "max": float(X[c].max()),
                    "median": float(X[c].median())} for c in num_cols},
    "categorical": {c: sorted(X[c].astype(str).unique().tolist()) for c in cat_cols},
    "target": TARGET,
}
with open(OUT / "schema.json", "w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE
)

# 5. Preprocessing
pre = ColumnTransformer([
    ("num", SimpleImputer(strategy="median"), num_cols),
    ("cat", Pipeline([
        ("imp", SimpleImputer(strategy="most_frequent")),
        ("oh", OneHotEncoder(handle_unknown="ignore")),
    ]), cat_cols),
])

# 6. Models
models = {
    "RandomForest": RandomForestRegressor(
        n_estimators=200, min_samples_leaf=5, n_jobs=-1, random_state=RANDOM_STATE),
    "XGBoost": XGBRegressor(
        n_estimators=400, learning_rate=0.05, max_depth=6,
        subsample=0.8, colsample_bytree=0.8, n_jobs=-1, random_state=RANDOM_STATE),
    "LightGBM": LGBMRegressor(
        n_estimators=400, learning_rate=0.05, n_jobs=-1,
        random_state=RANDOM_STATE, verbose=-1),
}

# 7. Train and evaluate
results, fitted, preds = {}, {}, {}
for name, model in models.items():
    pipe = Pipeline([("pre", pre), ("model", model)])
    t0 = time.time()
    pipe.fit(X_train, y_train)
    train_time = time.time() - t0

    pred = pipe.predict(X_test)
    results[name] = {
        "MAE": round(float(mean_absolute_error(y_test, pred)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(y_test, pred))), 3),
        "R2": round(float(r2_score(y_test, pred)), 4),
        "Train_R2": round(float(r2_score(y_train, pipe.predict(X_train))), 4),
        "train_seconds": round(train_time, 1),
    }
    fitted[name], preds[name] = pipe, pred
    print(name, results[name])
    joblib.dump(pipe, OUT / f"{name.lower()}_model.joblib")

# 8. Feature importance, grouped by original column
importances = {}
for name, pipe in fitted.items():
    names = pipe.named_steps["pre"].get_feature_names_out()
    imp = pipe.named_steps["model"].feature_importances_
    grouped = {}
    for n, v in zip(names, imp):
        n = n.split("__", 1)[1]
        orig = next((c for c in cat_cols if n.startswith(c + "_")), n)
        grouped[orig] = grouped.get(orig, 0.0) + float(v)
    total = sum(grouped.values()) or 1.0
    importances[name] = dict(sorted(((k, v / total) for k, v in grouped.items()),
                                    key=lambda kv: kv[1], reverse=True))

# 9. Save results
best = min(results, key=lambda k: results[k]["RMSE"])
with open(OUT / "metrics.json", "w", encoding="utf-8") as f:
    json.dump({"metrics": results, "importances": importances, "best_model": best}, f, indent=2)

# 10. Plots
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
lo, hi = float(y_test.min()), float(y_test.max())
for ax, name in zip(axes, models):
    ax.scatter(y_test.iloc[:3000], preds[name][:3000], s=3, alpha=0.4)
    ax.plot([lo, hi], [lo, hi], "r--")
    ax.set_title(f"{name}: actual vs predicted")
    ax.set_xlabel("Actual")
    ax.set_ylabel("Predicted")
plt.tight_layout()
plt.savefig(OUT / "actual_vs_predicted.png", dpi=150)
plt.close()

fig, axes = plt.subplots(1, 3, figsize=(18, 6))
for ax, name in zip(axes, importances):
    top = list(importances[name].items())[:12][::-1]
    ax.barh([k for k, _ in top], [v for _, v in top])
    ax.set_title(f"{name}: top features")
plt.tight_layout()
plt.savefig(OUT / "feature_importance.png", dpi=150)
plt.close()

# 11. Inference on the held-out row
row = holdout.drop(columns=TARGET)
print(f"\nHoldout actual: {float(holdout[TARGET].iloc[0]):.1f}")
for name, pipe in fitted.items():
    print(f"{name:13s} predicted: {float(pipe.predict(row)[0]):.1f}")

print("\nSummary:")
print(pd.DataFrame(results).T[["MAE", "RMSE", "R2", "Train_R2", "train_seconds"]])
print("Best model (lowest RMSE):", best)
print("Files saved in:", OUT)