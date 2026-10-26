import { useEffect, useMemo, useRef, useState } from "react";
import { fetchHoldout, fetchMetrics, fetchSchema, predict } from "./api";
import { defaultValues, groupsFor } from "./fields";
import AppHeader from "./components/AppHeader";
import ModelComparison from "./components/ModelComparison";
import PredictionForm from "./components/PredictionForm";
import ResultCard from "./components/ResultCard";
import Sidebar, { type View } from "./components/Sidebar";
import { sectionId, useScrollProgress, useScrollSpy } from "./hooks/useScrollSpy";
import type { FormValues, MetricsPayload, PredictionResult, Schema } from "./types";
import "./app.css";

export default function App() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [modelChoice, setModelChoice] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [sampleActual, setSampleActual] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("predict");

  const groups = useMemo(() => (schema ? groupsFor(schema) : []), [schema]);
  const ids = view === "predict" ? groups.map((g) => sectionId(g.title)) : [];
  const [activeId, setActiveId] = useScrollSpy(ids);
  const scrollProgress = useScrollProgress();
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetchSchema(), fetchMetrics()])
      .then(([s, m]) => {
        setSchema(s);
        setMetrics(m);
        setValues(defaultValues(s));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // On narrow screens the result sits below the form, so bring it into view
  useEffect(() => {
    if (result && window.innerWidth < 1180) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  if (loadError) {
    return (
      <div className="lx-app lx-boot">
        <div className="lx-result lx-result-error" role="alert">
          <h2>Can't reach the backend</h2>
          <p>{loadError}</p>
          <p className="lx-muted">
            Start it from the backend folder with <code>uvicorn main:app --reload --port 8000</code>, then refresh.
          </p>
        </div>
      </div>
    );
  }

  if (!schema || !metrics) {
    return (
      <div className="lx-app lx-boot" aria-busy="true">
        <div className="lx-skeleton" style={{ height: 420 }} />
      </div>
    );
  }

  const handleChange = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setSampleActual(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const features: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(values)) {
        features[k] = k in schema.numeric ? Number(v) : v;
      }
      setResult(await predict(features, modelChoice || null));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async () => {
    setError(null);
    try {
      const h = await fetchHoldout();
      const next: FormValues = {};
      for (const [k, v] of Object.entries(h.features)) next[k] = String(v);
      setValues(next);
      setSampleActual(h.actual);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleReset = () => {
    setValues(defaultValues(schema));
    setSampleActual(null);
    setResult(null);
    setError(null);
  };

  const navigate = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changeView = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const best = metrics.metrics[metrics.best_model];

  return (
    <div className="lx-app">
      <div className="lx-topbar" aria-hidden="true">
        <i style={{ transform: `scaleX(${scrollProgress})` }} />
      </div>

      <Sidebar view={view} onViewChange={changeView} groups={groups} activeId={activeId} onNavigate={navigate} />

      <div className="lx-main">
        <AppHeader
          title={view === "predict" ? "Predict life expectancy" : "Model comparison"}
          subtitle={
            view === "predict"
              ? "Enter a person's details to estimate age at death."
              : "Random Forest, XGBoost and LightGBM compared on the held-out test set."
          }
          bestModel={metrics.best_model}
          rmse={best?.RMSE}
          r2={best?.R2}
        />

        <main className="lx-content">
          {view === "predict" ? (
            <div className="lx-predict">
              <PredictionForm
                schema={schema}
                values={values}
                models={Object.keys(metrics.metrics)}
                modelChoice={modelChoice}
                loading={loading}
                onChange={handleChange}
                onModelChange={setModelChoice}
                onSubmit={handleSubmit}
                onLoadSample={handleLoadSample}
                onReset={handleReset}
              />
              <div className="lx-aside" ref={resultRef}>
                <ResultCard result={result} actual={result ? sampleActual : null} error={error} />
              </div>
            </div>
          ) : (
            <ModelComparison data={metrics} />
          )}
        </main>
      </div>
    </div>
  );
}