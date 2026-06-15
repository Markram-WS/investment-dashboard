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
  return (
  <section className="mb-6">
    <div className="rounded-2xl bg-purple-50 p-8 flex flex-col border border-hairline-soft">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest">Performance</h3>
        <div className="flex items-center gap-4">
          {performanceData && viewMode === "equity" && (
            <span className="text-xs text-slate font-medium">
              Total P/L: ${performanceData.total_pl?.toLocaleString()}
            </span>
          )}
          <div className="flex p-1 bg-canvas rounded-full border border-hairline shadow-sm">
            <button
              onClick={() => onViewModeChange("equity")}
              className={`px-4 py-1.5 text-[10px] font-bold rounded-full shadow-sm transition-all ${viewMode === "equity" ? "bg-ink text-white" : "bg-gray-200 text-ink hover:bg-gray-300"}`}
            >
              Equity
            </button>
            <button
              onClick={() => onViewModeChange("payoff")}
              className={`px-4 py-1.5 text-[10px] font-bold rounded-full transition-all ${viewMode === "payoff" ? "bg-ink text-white" : "bg-gray-200 text-ink hover:bg-gray-300"}`}
            >
              Payoff
            </button>
          </div>
        </div>
      </div>
      {viewMode === "equity" ? (
        performanceData ? (
          <PerformanceChart data={performanceData} viewMode={viewMode} />
        ) : (
          <div className="h-40 flex items-center justify-center text-xs text-slate">Loading performance data...</div>
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
