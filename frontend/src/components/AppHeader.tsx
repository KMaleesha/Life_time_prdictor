interface Props {
  title: string;
  subtitle: string;
  bestModel?: string;
  rmse?: number;
  r2?: number;
}

export default function AppHeader({ title, subtitle, bestModel, rmse, r2 }: Props) {
  return (
    <header className="lx-head">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {bestModel && (
        <div className="lx-badges" aria-label="Best model summary">
          <span className="lx-badge">Best model <b>{bestModel}</b></span>
          {rmse !== undefined && <span className="lx-badge">RMSE <b>{rmse.toFixed(2)} yrs</b></span>}
          {r2 !== undefined && <span className="lx-badge">R² <b>{r2.toFixed(3)}</b></span>}
        </div>
      )}
    </header>
  );
}
