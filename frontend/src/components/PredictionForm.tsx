import type { FormValues, Schema } from "../types";
import { groupsFor, isBinary, isDecimal, labelFor } from "../fields";
import { sectionId } from "../hooks/useScrollSpy";

interface Props {
  schema: Schema;
  values: FormValues;
  models: string[];
  modelChoice: string;
  loading: boolean;
  onChange: (name: string, value: string) => void;
  onModelChange: (model: string) => void;
  onSubmit: () => void;
  onLoadSample: () => void;
  onReset: () => void;
}

export default function PredictionForm(p: Props) {
  const { schema, values } = p;

  const renderField = (name: string) => {
    const label = labelFor(name);
    const num = schema.numeric[name];

    if (num && isBinary(schema, name)) {
      const labelId = `lbl-${name}`;
      return (
        <div key={name} className="lx-field" role="group" aria-labelledby={labelId}>
          <span id={labelId} className="lx-label">{label}</span>
          <div className="lx-toggle">
            {[["0", "No"], ["1", "Yes"]].map(([v, text]) => (
              <button key={v} type="button" aria-pressed={values[name] === v} onClick={() => p.onChange(name, v)}>
                {text}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (num) {
      return (
        <label key={name} className="lx-field">
          <span className="lx-label">
            {label}
            <em>{num.min}–{num.max}</em>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={num.min}
            max={num.max}
            step={isDecimal(name) ? 0.1 : 1}
            value={values[name]}
            onChange={(e) => p.onChange(name, e.target.value)}
          />
        </label>
      );
    }
    return (
      <label key={name} className="lx-field">
        <span className="lx-label">{label}</span>
        <select value={values[name]} onChange={(e) => p.onChange(name, e.target.value)}>
          {schema.categorical[name].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <form
      className="lx-form"
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
    >
      <div className="lx-quick">
        <p>
          <strong>Quick start</strong>
          <span>Load a real row from the test data, or fill in the sections below.</span>
        </p>
        <div className="lx-row">
          <button type="button" className="lx-btn lx-btn-ghost" onClick={p.onLoadSample}>Load sample row</button>
          <button type="button" className="lx-btn lx-btn-ghost" onClick={p.onReset}>Reset</button>
        </div>
      </div>

      {groupsFor(schema).map((g, i) => (
        <section key={g.title} id={sectionId(g.title)} className="lx-sec">
          <div className="lx-sec-head">
            <span className="num">{i + 1}</span>
            <h2>{g.title}</h2>
            <span className="cnt">{g.fields.length} fields</span>
          </div>
          <div className="lx-grid">{g.fields.map(renderField)}</div>
        </section>
      ))}

      <div className="lx-actions">
        <label className="lx-field lx-model">
          <span className="lx-label">Prediction model</span>
          <select value={p.modelChoice} onChange={(e) => p.onModelChange(e.target.value)}>
            <option value="">Best model (automatic)</option>
            {p.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="lx-btn lx-btn-primary" disabled={p.loading}>
          {p.loading && <span className="lx-spinner" aria-hidden="true" />}
          {p.loading ? "Predicting…" : "Predict"}
        </button>
      </div>
    </form>
  );
}