import type { PredictionResult } from "../types";

interface Props {
  result: PredictionResult | null;
  actual: number | null; // only set when the loaded sample row is unchanged
  error: string | null;
}

const clampPct = (age: number) => Math.max(0, Math.min(100, age));

export default function ResultCard({ result, actual, error }: Props) {
  if (error) {
    return (
      <div className="lx-result lx-result-error" role="alert">
        <h2>Prediction failed</h2>
        <p>{error}</p>
        <p className="lx-muted">Check that the backend is running and every field is within its allowed range.</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="lx-result lx-result-empty">
        <h2>Prediction</h2>
        <p className="lx-muted">Your estimate will appear here.</p>
        <div className="lx-ph" />
        <ol className="lx-howto">
          <li>Enter details, or load a sample row.</li>
          <li>Pick a model, or keep the automatic best one.</li>
          <li>Press Predict.</li>
        </ol>
      </div>
    );
  }

  const ages = Object.values(result.all_models);
  const spread = ages.length ? Math.max(...ages) - Math.min(...ages) : 0;

  return (
    <div className="lx-result" aria-live="polite">
      <h2>Prediction</h2>
      <div className="lx-hero">
        <span className="lx-big">{result.predicted_age_of_death.toFixed(1)}</span>
        <span className="lx-unit">years</span>
      </div>
      <p className="lx-muted">Estimated age at death, using {result.model}</p>
      <span className="lx-chip">About {result.estimated_remaining_years.toFixed(1)} years remaining</span>

      <div className="lx-gauge" aria-hidden="true">
        <div className="lx-gauge-track">
          <div className="lx-gauge-fill" style={{ width: `${clampPct(result.predicted_age_of_death)}%` }} />
        </div>
        <div className="lx-gauge-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      </div>

      {actual !== null && (
        <div className="lx-actual">
          Actual value in dataset: <strong>{actual.toFixed(1)}</strong>. Prediction error:{" "}
          <strong>{Math.abs(result.predicted_age_of_death - actual).toFixed(1)} years</strong>.
        </div>
      )}

      <div className="lx-models">
        <h3>All models{ages.length > 1 ? ` (they differ by ${spread.toFixed(1)} years)` : ""}</h3>
        {Object.entries(result.all_models).map(([name, v]) => (
          <div key={name} className={`lx-mrow ${name === result.model ? "hl" : ""}`}>
            <span className="name">{name}</span>
            <span className="bar"><i style={{ width: `${clampPct(v)}%` }} /></span>
            <span className="val">{v.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <p className="lx-disclaimer">{result.disclaimer}</p>
    </div>
  );
}