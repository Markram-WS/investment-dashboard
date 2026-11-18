import React from "react";

export interface ExposureRow {
  label: string;
  percent: number;
}

interface RiskCardProps {
  exposure: ExposureRow[];
  strategySet: boolean;
  notesPresent: boolean;
  onEdit: () => void;
}

const BAR_COLORS = ["var(--color-brand-teal)", "var(--color-tier-1)", "var(--color-brand-yellow)"];

/** Risk card: exposure bars plus the strategy/notes footer. Height follows content. */
const RiskCard: React.FC<RiskCardProps> = ({
  exposure, strategySet, notesPresent, onEdit,
}) => {
  return (
    <section className="at-card at-risk" aria-label="Risk">
      {exposure.length === 0 ? (
        <div className="at-exprow">
          <span>Exposure</span>
          <div className="at-ebar" />
          <span className="at-num">—</span>
        </div>
      ) : (
        exposure.map((row, i) => (
          <div className="at-exprow" key={row.label}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.label}
            </span>
            <div className="at-ebar">
              <i style={{ width: `${row.percent}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
            </div>
            <span className="at-num">{row.percent}%</span>
          </div>
        ))
      )}

      <div className="at-notes">
        <span>
          <b>Strategy</b> {strategySet ? "set" : "not set"}
        </span>
        <span>·</span>
        <span>
          <b>Notes</b> {notesPresent ? "saved" : "empty"}
        </span>
        <button type="button" className="at-notes-edit" onClick={onEdit}>
          Edit
        </button>
      </div>
    </section>
  );
};

export default React.memo(RiskCard);
