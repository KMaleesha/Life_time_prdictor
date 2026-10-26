import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { labelFor } from "../fields";
import type { MetricsPayload } from "../types/result";

const tick = { fill: "#5b6c78", fontSize: 12 };
const tooltipStyle = { borderRadius: 8, border: "1px solid #e2e8ed", boxShadow: "0 8px 24px -12px rgba(16,34,45,.25)", fontSize: 13 };

export default function ModelComparison({ data }: { data: MetricsPayload }) {
  const names = Object.keys(data.metrics);
  const [selected, setSelected] = useState(data.best_model in data.metrics ? data.best_model : names[0]);
  const best = data.metrics[data.best_model];

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
    <div className="lx-stack">
      {best && (
        <div className="lx-kpis">
          <div className="lx-kpi"><span>Best model</span><strong>{data.best_model}</strong></div>
          <div className="lx-kpi"><span>RMSE</span><strong>{best.RMSE.toFixed(2)} yrs</strong></div>
          <div className="lx-kpi"><span>MAE</span><strong>{best.MAE.toFixed(2)} yrs</strong></div>
          <div className="lx-kpi"><span>R²</span><strong>{best.R2.toFixed(3)}</strong></div>
        </div>
      )}

      <section className="lx-panel">
        <h2>Test set scores</h2>
        <p className="lx-muted">Lower error and higher R² are better. The best model has the lowest RMSE.</p>
        <div className="lx-table-wrap">
          <table className="lx-table">
            <thead>
              <tr><th>Model</th><th>MAE (yrs)</th><th>RMSE (yrs)</th><th>R²</th><th>Train R²</th><th>Train time (s)</th></tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const m = data.metrics[n];
                const isBest = n === data.best_model;
                return (
                  <tr key={n} className={isBest ? "hl" : ""}>
                    <td>{n}{isBest && <span className="lx-pill">Best</span>}</td>
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
        </div>
      </section>

      <div className="lx-charts">
        <section className="lx-panel">
          <h2>Error by model</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={errorData} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" vertical={false} />
              <XAxis dataKey="model" tick={tick} tickLine={false} axisLine={{ stroke: "#e2e8ed" }} />
              <YAxis tick={tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(11,110,110,.06)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="MAE" fill="#0b6e6e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="RMSE" fill="#c7821a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="lx-panel">
          <div className="lx-panel-head">
            <h2>Top features</h2>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Model for feature importance">
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={importanceData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" horizontal={false} />
              <XAxis type="number" unit="%" tick={tick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="feature" width={150} tick={tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(11,110,110,.06)" }} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="importance" name="Importance" fill="#0b6e6e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
}