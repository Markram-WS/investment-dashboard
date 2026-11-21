import React from "react";
import type { PortfolioRisk, PortfolioRiskBucket } from "../../types";
import { formatMoney, formatQty } from "../../utils/format";

interface RiskCardProps {
  risk?: PortfolioRisk | null;
  productTicker?: string | null;
  brokerCode?: string | null;
  strategySet: boolean;
  notesPresent: boolean;
  onEdit: () => void;
}

const signed = (v: number) => `${v > 0 ? "+" : ""}${formatMoney(v)}`;

const BUCKETS: { key: keyof PortfolioRisk["options"]["buckets"]; label: string }[] = [
  { key: "short_call", label: "Short call" },
  { key: "short_put", label: "Short put" },
  { key: "long_call", label: "Long call" },
  { key: "long_put", label: "Long put" },
];

/** label left, optional mid, signed value right. */
const Row: React.FC<{ label: string; mid?: string; value: React.ReactNode }> = ({
  label, mid, value,
}) => (
  <div className={`at-risk-row${mid === undefined ? " at-risk-row--pair" : ""}`}>
    <span className="at-k">{label}</span>
    {mid !== undefined && <span className="at-risk-mid">{mid}</span>}
    <span className="at-v at-num">{value}</span>
  </div>
);

const Pl: React.FC<{ value: number; fallback: boolean }> = ({ value, fallback }) => {
  if (fallback) return <>—</>;
  return <span className={value < 0 ? "at-neg" : "at-pos"}>{signed(value)}</span>;
};

const DASH = "—";

/** Risk card: the statement of the risk model, then the strategy/notes footer. */
const RiskCard: React.FC<RiskCardProps> = ({
  risk, productTicker, brokerCode, strategySet, notesPresent, onEdit,
}) => {
  const eq = risk?.eq;
  const options = risk?.options;
  const bucketCells = (b: PortfolioRiskBucket | undefined) =>
    b ? `${formatQty(b.orders)} · ${formatQty(b.lots)} · ${formatMoney(b.avg_premium)}` : DASH;

  const bandParts = risk
    ? [
        { kind: "size", value: risk.eq.size_at_x_mark },
        { kind: "available", value: risk.available_at_x },
        { kind: "profit", value: Math.max(0, risk.pl_total) },
      ]
    : [];
  const bandTotal = bandParts.reduce((sum, p) => sum + Math.max(0, p.value), 0);

  return (
    <section className="at-card at-risk" aria-label="Risk">
      <div className="at-risk-head">
        <span className="at-risk-title">Risk</span>
        <span className="at-risk-meta">
          X {risk ? formatQty(risk.x_amount) : DASH} · {productTicker ?? DASH} · {brokerCode ?? DASH}
        </span>
      </div>

      <div className="at-risk-group">
        <p className="at-k at-risk-glabel">EQ · Future</p>
        <Row label="Active orders" value={eq ? formatQty(eq.orders) : DASH} />
        <Row label="Total size" value={eq ? formatQty(eq.lots) : DASH} />
        <Row label="Average price" value={eq ? formatMoney(eq.avg_price) : DASH} />
        <Row label="Size @ 0" value={eq ? formatMoney(eq.size0) : DASH} />
        <Row label="Size @ X (mark)" value={eq ? formatMoney(eq.size_at_x_mark) : DASH} />
        <Row label="Size @ X (entry)" value={eq ? formatMoney(eq.size_at_x_entry) : DASH} />
        <Row label="Sum P/L" value={<Pl value={eq?.pl ?? 0} fallback={!eq} />} />
      </div>

      <div className="at-risk-group">
        <p className="at-k at-risk-glabel">Options</p>
        {BUCKETS.map(({ key, label }) => (
          <Row
            key={key}
            label={label}
            mid={bucketCells(options?.buckets[key])}
            value={<Pl value={options?.buckets[key].pl ?? 0} fallback={!options} />}
          />
        ))}
        <Row label="Net premium" value={<Pl value={options?.net_premium ?? 0} fallback={!options} />} />
        {options !== undefined && options.unclassified > 0 && (
          <Row label="Unclassified" value={formatQty(options.unclassified)} />
        )}
      </div>

      <div className="at-risk-group">
        <p className="at-k at-risk-glabel">Total</p>
        <Row label="Sum P/L" value={<Pl value={risk?.pl_total ?? 0} fallback={!risk} />} />
        <Row label="Margin locked" value={risk ? formatMoney(risk.margin_locked) : DASH} />
      </div>

      <div className="at-risk-band">
        <div className="at-risk-bar" role="img" aria-label="Risk composition">
          {bandTotal > 0 &&
            bandParts
              .filter((p) => p.value > 0)
              .map((p) => (
                <i
                  key={p.kind}
                  data-kind={p.kind}
                  style={{ width: `${(p.value / bandTotal) * 100}%` }}
                />
              ))}
        </div>
        <div className="at-risk-cap">
          <span>risk = available + P/L</span>
          <span className={`at-num${risk && risk.pl_total < 0 ? " at-neg" : ""}`}>
            {risk ? (risk.pl_total < 0 ? signed(risk.risk) : formatMoney(risk.risk)) : DASH}
          </span>
        </div>
      </div>

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
