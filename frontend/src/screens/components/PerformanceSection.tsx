import React from "react";
import { SpreadOrder } from "../../types";
import type { OptionRow } from "./OptionsStrategyTable";
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
}

const PerformanceSection: React.FC<PerformanceSectionProps> = ({
  performanceData, viewMode, onViewModeChange,
  activeOrders, strategyRows, ivMode,
  payoffMinPrice, payoffMaxPrice, activeIVs,
}) => {
  const safeActiveOrders = activeOrders || [];
  const safeStrategyRows = strategyRows || [];
  const safeIvMode = ivMode ?? false;
  const safeActiveIVs = activeIVs || {};
  const safePayoffMinPrice = payoffMinPrice ?? 0;
  const safePayoffMaxPrice = payoffMaxPrice ?? 0;
  const equityCurve = performanceData?.equity_curve;
  const hasEquityData = Array.isArray(equityCurve) && equityCurve.length > 0;
  return (
  <section style={{ marginBottom: 48 }}>
    <div className="flex flex-col" style={{ background: "var(--color-canvas)", borderRadius: 16, padding: 24 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate)", margin: 0 }}>Performance</h3>
        <div className="flex items-center" style={{ gap: 16 }}>
          {performanceData && viewMode === "equity" && (
            <span style={{ fontSize: 12, color: "var(--color-slate)" }}>
              Total P/L: ${performanceData.total_pl?.toLocaleString()}
            </span>
          )}
          <div className="flex" style={{ background: "var(--color-surface-soft)", borderRadius: 999, padding: 3 }}>
            <button
              onClick={() => onViewModeChange("equity")}
              className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === "equity" ? "bg-ink text-canvas" : "text-slate hover:text-ink"}`}
              style={{ fontSize: 11, fontWeight: 500 }}
            >
              Equity
            </button>
            <button
              onClick={() => onViewModeChange("payoff")}
              className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === "payoff" ? "bg-ink text-canvas" : "text-slate hover:text-ink"}`}
              style={{ fontSize: 11, fontWeight: 500 }}
            >
              Payoff
            </button>
          </div>
        </div>
      </div>
      {viewMode === "equity" ? (
        hasEquityData ? (
          <PerformanceChart data={performanceData} viewMode={viewMode} />
        ) : (
          <div className="flex items-center justify-center" style={{ paddingTop: 32, paddingBottom: 32 }}>
            <span style={{ fontSize: 12, color: "var(--color-slate)" }}>No trade data yet</span>
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
  </section>
);
};

export default React.memo(PerformanceSection);
