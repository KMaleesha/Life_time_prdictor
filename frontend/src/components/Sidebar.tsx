import type { groupsFor } from "../fields";
import { sectionId } from "../hooks/useScrollSpy";
import { ChartIcon, FormIcon, LogoIcon } from "./Icons";

type Group = ReturnType<typeof groupsFor>[number];
export type View = "predict" | "models";

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  groups: Group[];
  activeId: string;
  onNavigate: (id: string) => void;
}

export default function Sidebar({
  view,
  onViewChange,
  groups,
  activeId,
  onNavigate,
}: Props) {
  const activeIndex = Math.max(
    0,
    groups.findIndex((g) => sectionId(g.title) === activeId),
  );
  const current = groups[activeIndex];

  return (
    <aside className="lx-side">
      <div className="lx-brand">
        <span className="lx-logo">
          <LogoIcon />
        </span>
        <div>
          <b>LifeSpan Lab</b>
          <small>Life expectancy lab</small>
        </div>
      </div>

      <nav aria-label="Main">
        <div className="lx-nav-label">Workspace</div>
        <button
          className="lx-nav-item"
          aria-current={view === "predict" ? "page" : undefined}
          onClick={() => onViewChange("predict")}
        >
          <FormIcon /> Predict
        </button>
        <button
          className="lx-nav-item"
          aria-current={view === "models" ? "page" : undefined}
          onClick={() => onViewChange("models")}
        >
          <ChartIcon /> Model comparison
        </button>
      </nav>

      {view === "predict" && current && (
        <nav aria-label="Form sections">
          <div className="lx-progress">
            <div className="lx-progress-top">
              <strong>
                Section {activeIndex + 1} of {groups.length}
              </strong>
              <span>
                {Math.round(((activeIndex + 1) / groups.length) * 100)}%
              </span>
            </div>
            <div className="lx-segs">
              {groups.map((g, i) => (
                <button
                  key={g.title}
                  type="button"
                  aria-label={`Go to ${g.title}`}
                  className={`lx-seg ${i < activeIndex ? "done" : ""} ${i === activeIndex ? "current" : ""}`}
                  onClick={() => onNavigate(sectionId(g.title))}
                />
              ))}
            </div>
            <div className="lx-progress-title">{current.title}</div>
          </div>

          <ol className="lx-steps">
            {groups.map((g, i) => {
              const id = sectionId(g.title);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`lx-step ${i === activeIndex ? "active" : ""} ${i < activeIndex ? "done" : ""}`}
                    aria-current={i === activeIndex ? "step" : undefined}
                    onClick={() => onNavigate(id)}
                  >
                    <span className="num">{i + 1}</span>
                    {g.title}
                    <span className="n">{g.fields.length}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <p className="lx-side-foot">
        Educational demo built on a synthetic dataset. Not medical advice.
      </p>
    </aside>
  );
}
