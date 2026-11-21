import React, { type ReactNode } from "react";
import { SpreadOrder } from "../../types";
import type { OptionRow } from "./OptionsStrategyTable";
import { formatMoney } from "../../utils/format";
import PerformanceChart from "./PerformanceChart";
import PayoffChart from "./PayoffChart";

interface PerformanceSectionProps {
  performanceData: any;
  viewMode: "equity" | "payoff";
  onViewModeChange: (mode: "equity" | "payoff") => void;
  activeOrders?: SpreadOrder[];
  strategyRows?: OptionRow[];
  ivMode?: boolean;
  payoffMinPrice?: number;
  payoffMaxPrice?: number;
  activeIVs?: Record<string, number>;
  /** Renders borderless inside a parent card (payoff pane) instead of as a page section. */
  embedded?: boolean;
  /** Right-aligned slot in the embedded header, e.g. the card's "Option legs" action. */
  actions?: ReactNode;
}

const VIEW_TABS = [
  { mode: "equity", label: "Equity" },
  { mode: "payoff", label: "Payoff" },
] as const;

const PerformanceSection: React.FC<PerformanceSectionProps> = ({
  performanceData, viewMode, onViewModeChange,
  activeOrders, strategyRows, ivMode,
  payoffMinPrice, payoffMaxPrice, activeIVs, embedded = false, actions,
}) => {
  const safeActiveOrders = activeOrders || [];
  const safeStrategyRows = strategyRows || [];
  const safeIvMode = ivMode ?? false;
  const safeActiveIVs = activeIVs || {};
  const safePayoffMinPrice = payoffMinPrice ?? 0;
  const safePayoffMaxPrice = payoffMaxPrice ?? 0;
  const equityCurve = performanceData?.equity_curve;
  const hasEquityData = Array.isArray(equityCurve) && equityCurve.length > 0;
  const uid = React.useId().replace(/:/g, "");
  const panelId = `${uid}-panel`;

  const totalPlValue = Number(performanceData?.total_pl ?? 0);
  const totalPlSign = totalPlValue > 0 ? "+" : totalPlValue < 0 ? "-" : "";
  const totalPlColor =
    totalPlValue > 0
      ? "var(--color-positive-text)"
      : totalPlValue < 0
        ? "var(--color-danger-text)"
        : "var(--color-slate)";

  const totalPl = performanceData && viewMode === "equity" ? (
    <span
      className="text-[length:var(--fs-label)]"
      style={{
        color: "var(--color-slate)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      Total P/L:{" "}
      <span style={{ color: totalPlColor, fontWeight: 600 }}>
        {totalPlSign}{formatMoney(Math.abs(totalPlValue))}
      </span>
    </span>
  ) : null;

  // Two mutually exclusive views: a tablist with roving focus and arrow keys.
  const tabList = (
    <div
      role="tablist"
      aria-label="Performance view"
      className="flex"
      style={{ background: "var(--color-surface-soft)", borderRadius: 999, padding: embedded ? 2 : 3 }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next = viewMode === "equity" ? "payoff" : "equity";
        onViewModeChange(next);
        document.getElementById(`${uid}-${next}-tab`)?.focus();
      }}
    >
      {VIEW_TABS.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          role="tab"
          id={`${uid}-${tab.mode}-tab`}
          aria-selected={viewMode === tab.mode}
          aria-controls={panelId}
          tabIndex={viewMode === tab.mode ? 0 : -1}
          onClick={() => onViewModeChange(tab.mode)}
          className={`px-4 rounded-full transition-colors text-[length:var(--fs-label)] ${viewMode === tab.mode ? "bg-ink text-canvas" : "text-slate hover:text-ink"}`}
          style={{
            fontWeight: 500,
            ...(embedded ? { height: 24, paddingTop: 0, paddingBottom: 0, lineHeight: "24px" } : {}),
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
  <section
    style={embedded
      ? { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }
      : { marginBottom: 48 }}
  >
    <div
      className="flex flex-col"
      style={embedded
        ? { flex: "1 1 auto", minHeight: 0, background: "transparent" }
        : { background: "var(--color-canvas)", borderRadius: 16, padding: 24 }}
    >
      {embedded ? (
        <div
          className="flex items-center"
          style={{ height: 28, marginBottom: 8, gap: 16, flex: "0 0 auto" }}
        >
          {tabList}
          {totalPl}
          {actions ? <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>{actions}</div> : null}
        </div>
      ) : (
        <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
          <h3 className="text-[length:var(--fs-label)]" style={{ fontWeight: 500, color: "var(--color-slate)", margin: 0 }}>Performance</h3>
          <div className="flex items-center" style={{ gap: 16 }}>
            {totalPl}
            {tabList}
          </div>
        </div>
      )}
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${uid}-${viewMode}-tab`}
        style={embedded
          ? { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }
          : undefined}
      >
        {viewMode === "equity" ? (
          hasEquityData ? (
            <PerformanceChart data={performanceData} viewMode={viewMode} />
          ) : (
            <div className="flex items-center justify-center" style={{ paddingTop: 32, paddingBottom: 32 }}>
              <span className="text-[length:var(--fs-label)]" style={{ color: "var(--color-slate)" }}>No trade data yet</span>
            </div>
          )
        ) : (
          <PayoffChart
            activeOrders={safeActiveOrders}
            strategyRows={safeStrategyRows}
            ivMode={safeIvMode}
            minPrice={safePayoffMinPrice}
            maxPrice={safePayoffMaxPrice}
            activeIVs={safeActiveIVs}
          />
        )}
      </div>
    </div>
  </section>
);
};

export default React.memo(PerformanceSection);
