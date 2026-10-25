import type { FormValues, Schema } from "../types";
import { groupsFor, isBinary, isDecimal, labelFor } from "../fields";

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
      return (
        <label key={name} className="field">
          <span>{label}</span>
          <select value={values[name]} onChange={(e) => p.onChange(name, e.target.value)}>
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </label>
      );
    }
    if (num) {
      return (
        <label key={name} className="field">
          <span>
            {label} <em>({num.min}–{num.max})</em>
          </span>
          <input
            type="number"
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
      <label key={name} className="field">
        <span>{label}</span>
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
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
    >
      <div className="card-head">
        <h2>Enter details</h2>
        <div className="row">
          <button type="button" className="btn ghost" onClick={p.onLoadSample}>
            Load sample row
          </button>
          <button type="button" className="btn ghost" onClick={p.onReset}>
            Reset
          </button>
        </div>
      </div>

      {groupsFor(schema).map((g) => (
        <fieldset key={g.title}>
          <legend>{g.title}</legend>
          <div className="grid">{g.fields.map(renderField)}</div>
        </fieldset>
      ))}

      <div className="submit-row">
        <label className="field inline">
          <span>Model</span>
          <select value={p.modelChoice} onChange={(e) => p.onModelChange(e.target.value)}>
            <option value="">Best model (auto)</option>
            {p.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn primary" disabled={p.loading}>
          {p.loading ? "Predicting…" : "Predict"}
        </button>
      </div>
    </form>
  );
}
