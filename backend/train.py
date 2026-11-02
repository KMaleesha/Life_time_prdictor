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
import shap
from interpret.glassbox import ExplainableBoostingRegressor
from lightgbm import LGBMRegressor
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

RANDOM_STATE = 42
SAMPLE_SIZE = 150_000
TARGET = "simulated_age_of_death"
PRIMARY = "EBM"  # the new algorithm
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

# 3. Hold out one row for the demo
holdout = df.sample(1, random_state=RANDOM_STATE)
df = df.drop(holdout.index)
holdout.to_json(OUT / "holdout_row.json", orient="records", indent=2)

# 4. Features and target
X = df.drop(columns=TARGET)
y = df[TARGET]
num_cols = X.select_dtypes(include="number").columns.tolist()
cat_cols = X.select_dtypes(exclude="number").columns.tolist()

schema = {
    "numeric": {c: {"min": float(X[c].min()), "max": float(X[c].max()),
                    "median": float(X[c].median())} for c in num_cols},
    "categorical": {c: sorted(X[c].astype(str).unique().tolist()) for c in cat_cols},
    "target": TARGET,
    "feature_order": X.columns.tolist(),  # EBM needs the same column order
}
with open(OUT / "schema.json", "w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2)

# 5. Split: 70% train, 15% validation, 15% test
X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=0.15, random_state=RANDOM_STATE)
X_train, X_val, y_train, y_val = train_test_split(
    X_tmp, y_tmp, test_size=0.15 / 0.85, random_state=RANDOM_STATE)
print("Train/val/test:", len(X_train), len(X_val), len(X_test))

# 6. Preprocessing (baselines only, EBM handles categories itself)
pre = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")),
                      ("sc", StandardScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                      ("oh", OneHotEncoder(handle_unknown="ignore"))]), cat_cols),
])


def rmse(a, b):
    return float(np.sqrt(mean_squared_error(a, b)))


# 7. Tune EBM on the validation set (small grid, 40k-row subsample for speed)
def make_ebm(**kw):
    return ExplainableBoostingRegressor(
        max_bins=256, outer_bags=8, max_rounds=1500, early_stopping_rounds=50,
        n_jobs=-1, random_state=RANDOM_STATE, **kw)


grid = [
    {"interactions": 0, "learning_rate": 0.03},
    {"interactions": 10, "learning_rate": 0.03},
    {"interactions": 10, "learning_rate": 0.01},
    {"interactions": 20, "learning_rate": 0.03},
]
sub = X_train.sample(min(40_000, len(X_train)), random_state=RANDOM_STATE)
tuning = []
for cfg in grid:
    m = make_ebm(**cfg).fit(sub, y_train.loc[sub.index])
    score = rmse(y_val, m.predict(X_val))
    tuning.append({**cfg, "val_rmse": round(score, 3)})
    print("EBM tuning:", tuning[-1])
best_cfg = min(tuning, key=lambda t: t["val_rmse"])
best_cfg = {k: v for k, v in best_cfg.items() if k != "val_rmse"}
print("Best EBM config:", best_cfg)

# 8. Models: EBM (new) + two benchmarks from the lectures
models = {
    PRIMARY: make_ebm(**best_cfg),
    "RandomForest": Pipeline([("pre", clone(pre)), ("model", RandomForestRegressor(
        n_estimators=200, min_samples_leaf=5, n_jobs=-1, random_state=RANDOM_STATE))]),
    "LightGBM": Pipeline([("pre", clone(pre)), ("model", LGBMRegressor(
        n_estimators=400, learning_rate=0.05, n_jobs=-1,
        random_state=RANDOM_STATE, verbose=-1))]),
}

results, preds = {}, {}
for name, model in models.items():
    t0 = time.time()
    model.fit(X_train, y_train)
    secs = time.time() - t0
    pred = model.predict(X_test)
    results[name] = {
        "MAE": round(float(mean_absolute_error(y_test, pred)), 3),
        "RMSE": round(rmse(y_test, pred), 3),
        "R2": round(float(r2_score(y_test, pred)), 4),
        "Train_R2": round(float(r2_score(y_train, model.predict(X_train))), 4),
        "Val_RMSE": round(rmse(y_val, model.predict(X_val)), 3),
        "train_seconds": round(secs, 1),
    }
    preds[name] = pred
    print(name, results[name])
    joblib.dump(model, OUT / f"{name.lower()}_model.joblib")

# 9. Feature importance (EBM terms include interactions like "age & smoking")
importances = {}
ebm = models[PRIMARY]
raw = dict(zip(ebm.term_names_, map(float, ebm.term_importances())))
total = sum(raw.values()) or 1.0
importances[PRIMARY] = dict(sorted(((k, v / total) for k, v in raw.items()),
                                   key=lambda kv: kv[1], reverse=True))
for name in ["RandomForest", "LightGBM"]:
    pipe = models[name]
    names = pipe.named_steps["pre"].get_feature_names_out()
    imp = pipe.named_steps["model"].feature_importances_
    grouped = {}
    for n, v in zip(names, imp):
        n = n.split("__", 1)[1]
        orig = next((c for c in cat_cols if n.startswith(c + "_")), n)
        grouped[orig] = grouped.get(orig, 0.0) + float(v)
    s = sum(grouped.values()) or 1.0
    importances[name] = dict(sorted(((k, v / s) for k, v in grouped.items()),
                                    key=lambda kv: kv[1], reverse=True))

# 10. Partial dependence (EBM vs LightGBM) for the top EBM main effects
base = X_train.sample(2000, random_state=RANDOM_STATE)
top_feats = [k for k in importances[PRIMARY] if " & " not in k][:8]


def pdp_curve(model, feat, grid_vals):
    ys = []
    for g in grid_vals:
        tmp = base.copy()
        tmp[feat] = g
        ys.append(round(float(np.mean(model.predict(tmp))), 3))
    return ys


pdp = {}
for feat in top_feats:
    if feat in num_cols:
        gv = np.unique(np.quantile(X_train[feat], np.linspace(0.02, 0.98, 20)))
        gv = [float(v) for v in gv]
        kind = "numeric"
    else:
        gv = sorted(X_train[feat].astype(str).unique().tolist())
        kind = "categorical"
    pdp[feat] = {"type": kind, "x": gv,
                 "y": {n: pdp_curve(models[n], feat, gv) for n in [PRIMARY, "LightGBM"]}}

# 11. Fairness check: error by group on the test set (EBM)
resid = preds[PRIMARY] - y_test.to_numpy()
fairness = []
for c in cat_cols:
    if X_test[c].nunique() > 12:
        continue
    groups = []
    for g, idx in X_test.reset_index(drop=True).groupby(c).groups.items():
        r = resid[list(idx)]
        if len(r) >= 30:
            groups.append({"group": str(g), "n": int(len(r)),
                           "mae": round(float(np.abs(r).mean()), 3),
                           "bias": round(float(r.mean()), 3)})
    if groups:
        fairness.append({"feature": c, "groups": groups})

# 12. Save results
best = min(results, key=lambda k: results[k]["RMSE"])
with open(OUT / "metrics.json", "w", encoding="utf-8") as f:
    json.dump({"metrics": results, "importances": importances, "best_model": best,
               "primary_model": PRIMARY, "ebm_params": best_cfg, "tuning": tuning,
               "pdp": pdp, "fairness": fairness}, f, indent=2)

# 13. Plots for the report
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

# SHAP summary for the LightGBM benchmark (second XAI view)
try:
    lgb = models["LightGBM"]
    xs = X_test.sample(2000, random_state=RANDOM_STATE)
    xt = lgb.named_steps["pre"].transform(xs)
    xt = xt.toarray() if hasattr(xt, "toarray") else xt
    fn = [n.split("__", 1)[1] for n in lgb.named_steps["pre"].get_feature_names_out()]
    sv = shap.TreeExplainer(lgb.named_steps["model"]).shap_values(xt)
    shap.summary_plot(sv, xt, feature_names=fn, max_display=15, show=False)
    plt.tight_layout()
    plt.savefig(OUT / "shap_summary_lightgbm.png", dpi=150)
    plt.close()
except Exception as e:
    print("SHAP skipped:", e)

# 14. Demo inference
row = holdout.drop(columns=TARGET)
print(f"\nHoldout actual: {float(holdout[TARGET].iloc[0]):.1f}")
for name, m in models.items():
    print(f"{name:13s} predicted: {float(m.predict(row)[0]):.1f}")
print("\nSummary:")
print(pd.DataFrame(results).T)
print("Lowest RMSE:", best, "| Primary:", PRIMARY)