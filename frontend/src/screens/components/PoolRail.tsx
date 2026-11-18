import React from "react";
import type { PortfolioRisk } from "../../types";

interface PoolRailProps {
  totalValue: number;
  plPercent: number;
  totalPl: number;
  cash: number;
  marginLocked: number;
  cashBufferLimit: number;
  availableCash: number;
  marginUsed: number;
  initialCapital: number;
  risk?: PortfolioRisk | null;
}

const money = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const signed = (v: number) =>
  `${v < 0 ? "−" : "+"}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const pct = (v: number) => `${Math.round(v)}%`;

/** 84px pool band: equity, cash allocation bar, buffer/margin coverage. */
const PoolRail: React.FC<PoolRailProps> = ({
  totalValue, plPercent, totalPl, cash,
  marginLocked, cashBufferLimit, availableCash,
  marginUsed, initialCapital, risk,
}) => {
  const pool = marginLocked + cashBufferLimit + availableCash;
  const share = (v: number) => (pool > 0 ? (v / pool) * 100 : 0);
  const marginShare = share(marginLocked);
  const bufferShare = share(cashBufferLimit);
  const availableShare = share(availableCash);

  // Buffer coverage prefers the computed buffer at X; the legacy cash formula
  // stays as the fallback while the risk block is absent.
  const bufferCoverage = risk
    ? (risk.available_at_x / Math.max(cashBufferLimit, 1)) * 100
    : cashBufferLimit > 0
      ? ((cash + totalPl) / cashBufferLimit) * 100
      : cash > 0
        ? 100
        : 0;
  const coverageDanger = bufferCoverage < 120;

  const profit = totalPl + (risk?.pl_total ?? 0);
  const profitOfInitial = initialCapital > 0 ? (profit / initialCapital) * 100 : null;
  // One decimal, because rounding to whole percent hides a real profit on a
  // large base ($6 on $7,000 is 0.1%, not 0%); if even that rounds to 0.0 the
  // ratio says nothing, so the parenthetical is dropped rather than shown.
  const profitOfInitialPct = profitOfInitial === null ? null : Math.round(profitOfInitial * 10) / 10;
  const availableLabel = `available ${pct(availableShare)} of pool · of which profit ${signed(profit)}`;
  const allocationLabel = profitOfInitialPct === null || profitOfInitialPct === 0
    ? availableLabel
    : `${availableLabel} (${profitOfInitialPct.toFixed(1)}% of initial)`;

  return (
    <section className="at-card at-rail" aria-label="Pool summary">
      <div>
        <p className="at-k">Total value</p>
        <div className="at-equity">
          <b>{money(totalValue)}</b>
          <span className="at-pct" data-neg={plPercent < 0 ? "true" : undefined}>
            {plPercent >= 0 ? "" : "−"}
            {Math.abs(plPercent).toFixed(1)}%
          </span>
        </div>
        <div className="at-mezz">
          <div>
            <p className="at-k">Total P/L</p>
            <p className="at-v">{signed(totalPl)}</p>
          </div>
          <div>
            <p className="at-k">Cash</p>
            <p className="at-v">{money(cash)}</p>
          </div>
        </div>
      </div>

      <div className="at-vline" />

      <div>
        <div className="at-cashlbl">
          <span className="at-k">Cash allocation</span>
          <span className="at-k">{allocationLabel}</span>
        </div>
        <div className="at-bar" role="img" aria-label="Cash allocation">
          <div className="at-seg" data-kind="margin" style={{ width: `${marginShare}%` }}>
            Margin {money(marginLocked)}
          </div>
          <div className="at-seg" data-kind="buffer" style={{ width: `${bufferShare}%` }}>
            Buffer {money(cashBufferLimit)}
          </div>
          <div className="at-seg" data-kind="available" style={{ width: `${availableShare}%` }}>
            Available {money(availableCash)}
          </div>
        </div>
      </div>

      <div className="at-vline" />

      <div className="at-rail-side">
        <div className="at-hrow">
          <span className="at-k">Buffer coverage</span>
          <span
            className="at-hbig"
            style={{ color: coverageDanger ? "var(--color-danger-text)" : "var(--color-ink)" }}
          >
            {pct(bufferCoverage)}
          </span>
        </div>
        <div className="at-track">
          <i
            style={{
              width: `${Math.min(100, Math.max(0, bufferCoverage / 2))}%`,
              background: coverageDanger ? "var(--color-danger-text)" : "var(--color-brand-teal)",
            }}
          />
        </div>
        <div className="at-hrow" style={{ marginTop: 6, marginBottom: 4 }}>
          <span className="at-k">Margin used</span>
          <span style={{ fontSize: "var(--fs-label)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {pct(marginUsed)}
          </span>
        </div>
        <div className="at-track">
          <i style={{ width: `${Math.min(100, Math.max(0, marginUsed))}%`, background: "var(--color-brand-blue)" }} />
        </div>
      </div>
    </section>
  );
};

export default React.memo(PoolRail);
