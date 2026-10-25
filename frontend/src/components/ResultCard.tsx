import type { PredictionResult } from "../types";

interface Props {
  result: PredictionResult | null;
  actual: number | null;   // only set when the loaded sample row is unchanged
  error: string | null;
}

export default function ResultCard({ result, actual, error }: Props) {
  if (error) {
    return (
      <div className="card result error">
        <h2>Could not predict</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="card result">
        <h2>Prediction</h2>
        <p className="muted">Fill in the form (or load the sample row) and press Predict.</p>
      </div>
    );
  }

  return (
    <div className="card result">
      <h2>Prediction</h2>
      <div className="big">{result.predicted_age_of_death.toFixed(1)}</div>
      <div className="big-sub">estimated age at death ({result.model})</div>
      <div className="remaining">≈ {result.estimated_remaining_years.toFixed(1)} years remaining</div>

      {actual !== null && (
        <div className="actual">
          Actual value in dataset: <strong>{actual.toFixed(1)}</strong> · error:{" "}
          <strong>{Math.abs(result.predicted_age_of_death - actual).toFixed(1)} yrs</strong>
        </div>
      )}

      <table className="mini">
        <thead>
          <tr><th>Model</th><th>Predicted age</th></tr>
        </thead>
        <tbody>
          {Object.entries(result.all_models).map(([name, v]) => (
            <tr key={name} className={name === result.model ? "hl" : ""}>
              <td>{name}</td>
              <td>{v.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="disclaimer">{result.disclaimer}</p>
    </div>
  );
}
