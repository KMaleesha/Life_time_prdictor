import { useEffect, useState } from "react";
import { fetchHoldout, fetchMetrics, fetchSchema, predict } from "./api";
import { defaultValues } from "./fields";
import ModelComparison from "./components/ModelComparison";
import PredictionForm from "./components/PredictionForm";
import ResultCard from "./components/ResultCard";
import type { FormValues, MetricsPayload, PredictionResult, Schema } from "./types";

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

  useEffect(() => {
    Promise.all([fetchSchema(), fetchMetrics()])
      .then(([s, m]) => {
        setSchema(s);
        setMetrics(m);
        setValues(defaultValues(s));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  if (loadError) {
    return (
      <main className="container">
        <div className="card error">
          <h2>Cannot load the dashboard</h2>
          <p>{loadError}</p>
          <p className="muted">
            Start the backend: <code>uvicorn main:app --reload --port 8000</code> (inside the backend folder).
          </p>
        </div>
      </main>
    );
  }
  if (!schema || !metrics) {
    return <main className="container"><p>Loading…</p></main>;
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

  return (
    <main className="container">
      <header>
        <h1>Sri Lanka Life Expectancy Predictor</h1>
        <p className="muted">
          Random Forest vs XGBoost (+ LightGBM) trained on the synthetic AyuSanka health cohort.
          Educational demo, not medical advice.
        </p>
      </header>

      <div className="layout">
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
        <ResultCard result={result} actual={result ? sampleActual : null} error={error} />
      </div>

      <ModelComparison data={metrics} />
    </main>
  );
}
