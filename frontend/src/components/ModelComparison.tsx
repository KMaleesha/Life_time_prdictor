import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { labelFor } from "../fields";
import type { MetricsPayload } from "../types";

export default function ModelComparison({ data }: { data: MetricsPayload }) {
  const names = Object.keys(data.metrics);
  const [selected, setSelected] = useState(data.best_model in data.metrics ? data.best_model : names[0]);

  const errorData = names.map((n) => ({ model: n, MAE: data.metrics[n].MAE, RMSE: data.metrics[n].RMSE }));

  const importanceData = useMemo(
    () =>
      Object.entries(data.importances[selected] ?? {})
        .slice(0, 12)
        .map(([k, v]) => ({ feature: labelFor(k), importance: Math.round(v * 1000) / 10 }))
        .reverse(),
    [data, selected]
  );

  return (
    <section className="card">
      <h2>Model comparison (test set)</h2>

      <table className="metrics">
        <thead>
          <tr>
            <th>Model</th><th>MAE (yrs)</th><th>RMSE (yrs)</th><th>R²</th><th>Train R²</th><th>Train time (s)</th>
          </tr>
        </thead>
        <tbody>
          {names.map((n) => {
            const m = data.metrics[n];
            return (
              <tr key={n} className={n === data.best_model ? "hl" : ""}>
                <td>{n}{n === data.best_model ? " ★" : ""}</td>
                <td>{m.MAE.toFixed(3)}</td>
                <td>{m.RMSE.toFixed(3)}</td>
                <td>{m.R2.toFixed(4)}</td>
                <td>{m.Train_R2.toFixed(4)}</td>
                <td>{m.train_seconds}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">★ = lowest RMSE. Lower MAE/RMSE is better; R² closer to 1 is better.</p>

      <div className="charts">
        <div>
          <h3>Error by model</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={errorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="model" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="MAE" fill="#2563eb" />
              <Bar dataKey="RMSE" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div className="card-head">
            <h3>Top features</h3>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {names.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={importanceData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit="%" />
              <YAxis type="category" dataKey="feature" width={150} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="importance" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
