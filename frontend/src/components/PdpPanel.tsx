import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { labelFor } from "../fields";
import type { FairnessEntry, Pdp } from "../types/result";

const tick = { fill: "#5b6c78", fontSize: 12 };
const colors = ["#0b6e6e", "#c7821a", "#5b6c78"];

export function PdpPanel({ pdp }: { pdp: Record<string, Pdp> }) {
  const feats = Object.keys(pdp);
  const [f, setF] = useState(feats[0]);
  const p = pdp[f];
  if (!p) return null;
  const models = Object.keys(p.y);
  const data = p.x.map((x, i) => ({
    x: typeof x === "number" ? Math.round(x * 10) / 10 : x,
    ...Object.fromEntries(models.map((m) => [m, p.y[m][i]])),
  }));

  return (
    <section className="lx-panel">
      <div className="lx-panel-head">
        <h2>Partial dependence</h2>
        <select value={f} onChange={(e) => setF(e.target.value)} aria-label="Feature">
          {feats.map((k) => <option key={k} value={k}>{labelFor(k)}</option>)}
        </select>
      </div>
      <p className="lx-muted">Average predicted age at death as one feature changes.</p>
      <ResponsiveContainer width="100%" height={300}>
        {p.type === "numeric" ? (
          <LineChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" vertical={false} />
            <XAxis dataKey="x" tick={tick} />
            <YAxis tick={tick} domain={["auto", "auto"]} />
            <Tooltip />
            <Legend />
            {models.map((m, i) => <Line key={m} dataKey={m} stroke={colors[i]} dot={false} strokeWidth={2} />)}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" vertical={false} />
            <XAxis dataKey="x" tick={tick} />
            <YAxis tick={tick} domain={["auto", "auto"]} />
            <Tooltip />
            <Legend />
            {models.map((m, i) => <Bar key={m} dataKey={m} fill={colors[i]} radius={[4, 4, 0, 0]} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </section>
  );
}

export function FairnessPanel({ data }: { data: FairnessEntry[] }) {
  const [f, setF] = useState(data[0]?.feature);
  const entry = data.find((d) => d.feature === f);
  if (!entry) return null;
  return (
    <section className="lx-panel">
      <div className="lx-panel-head">
        <h2>Error by group (fairness check)</h2>
        <select value={f} onChange={(e) => setF(e.target.value)} aria-label="Group by">
          {data.map((d) => <option key={d.feature} value={d.feature}>{labelFor(d.feature)}</option>)}
        </select>
      </div>
      <p className="lx-muted">Bias = mean(predicted − actual). Large gaps between groups signal unfairness.</p>
      <div className="lx-table-wrap">
        <table className="lx-table">
          <thead><tr><th>Group</th><th>Rows</th><th>MAE (yrs)</th><th>Bias (yrs)</th></tr></thead>
          <tbody>
            {entry.groups.map((g) => (
              <tr key={g.group}><td>{g.group}</td><td>{g.n}</td><td>{g.mae.toFixed(2)}</td><td>{g.bias.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}