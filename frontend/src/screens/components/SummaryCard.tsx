import React from "react";
import TagsSection from "./TagsSection";
import { AllocationItem } from "../../types";

interface SummaryCardProps {
  totalValue: number;
  totalCash: number;
  totalNotional: number;
  cumulativePl: number;
  plPercent: number;
  availableCash: number;
  marginLocked: number;
  cashBufferLimit: number;
  moneyMarket: number;
  riskStatus: string;
  riskPercent: number;
  tags: Record<string, boolean> | null;
  assetAllocation: AllocationItem[];
}

const R = 16, CIRCUMFERENCE = 2 * Math.PI * R;

const SummaryCard: React.FC<SummaryCardProps> = ({
  totalValue, totalCash, totalNotional, cumulativePl, plPercent, availableCash,
  marginLocked, cashBufferLimit, moneyMarket, riskStatus, riskPercent, tags, assetAllocation,
}) => {
  let offset = 0;

  return (
  <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-hairline p-8 flex flex-col">
    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-6">Portfolio Summary</h3>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-hairline">
      <div className="flex flex-col">
        <p className="text-xs font-medium text-gray-500 mb-2">Total Value</p>
        <p className="text-3xl font-bold leading-none">${totalValue.toLocaleString()}</p>
        <p className="text-brand-teal text-sm font-semibold mt-2 flex items-center gap-1">
          {plPercent >= 0 ? "+" : ""}{plPercent.toFixed(1)}%
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </p>
      </div>
      <div className="flex flex-col">
        <p className="text-xs font-medium text-gray-500 mb-2">Total P/L</p>
        <p className={`text-3xl font-bold leading-none ${cumulativePl >= 0 ? "text-brand-teal" : "text-brand-coral"}`}>
          {cumulativePl >= 0 ? "+" : ""}${cumulativePl.toLocaleString()}
        </p>
        <p className="text-slate text-xs mt-2">All time performance</p>
      </div>
      <div className="flex flex-col">
        <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
          Available Cash
          <span className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate text-slate cursor-help text-[9px] font-bold leading-none group">
            i
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 px-3 py-2 bg-ink text-white text-[10px] leading-relaxed rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
              Available Cash + P/L − Money Market − Margin Locked − Cash Buffer
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-ink rotate-45"></div>
            </div>
          </span>
        </div>
        <p className="text-3xl font-bold leading-none text-ink">${Math.max(0, availableCash).toLocaleString()}</p>
        <p className="text-slate text-xs mt-2">Liquid after deductions</p>
      </div>
    </div>

    <div className="mb-8 pb-8 border-b border-hairline">
      <p className="text-[11px] font-bold text-gray-500 mb-4 uppercase tracking-widest">Cash Details</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1">Total Notional</p>
          <p className="text-lg font-bold">${totalNotional.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1">Money Market (T+3)</p>
          <p className="text-lg font-bold">${moneyMarket.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1">Margin Locked</p>
          <p className="text-lg font-bold">${marginLocked.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1">Cash Buffer Limit</p>
          <p className="text-lg font-bold">${cashBufferLimit.toLocaleString()}</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
      <div className="flex border-r border-hairline pr-8">
        <div className="flex flex-col w-full">
          <p className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-widest">Risk Level</p>
          <div className="flex items-center gap-8 md:gap-12">
            <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" fill="transparent" r="16" stroke="#f0f0f0" strokeWidth="3" />
                <circle cx="18" cy="18" fill="transparent" r="16"
                  stroke={riskPercent >= 100 ? "#0fbcb0" : riskPercent >= 50 ? "#ffd02f" : "#e74c3c"}
                  strokeDasharray={`${(riskPercent / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset="0" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <p className="text-[14px] font-bold text-ink">{riskPercent.toFixed(0)}%</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 items-start">
              <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-full border border-hairline">
                <span className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: riskPercent >= 100 ? "#0fbcb0" : riskPercent >= 50 ? "#ffd02f" : "#e74c3c" }} />
                <span className="text-[11px] font-bold uppercase tracking-wider">{riskStatus || "Safe"}</span>
              </div>
              <p className="text-[11px] text-slate font-medium max-w-[120px]">
                {riskPercent >= 100
                  ? "Buffer fully covers exposure"
                  : riskPercent >= 50
                    ? "Buffer partially covers exposure"
                    : "Exposure exceeds buffer capacity"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex pl-8">
        <div className="flex flex-col w-full">
          <p className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-widest">Asset Allocation</p>
          <div className="flex items-center gap-8 md:gap-12">
            <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" fill="transparent" r="16" stroke="#f0f0f0" strokeWidth="3" />
                {assetAllocation.map((a) => {
                  const dashLen = (a.percentage / 100) * CIRCUMFERENCE;
                  const gapLen = CIRCUMFERENCE - dashLen;
                  const segOffset = offset;
                  offset -= dashLen;
                  return (
                    <circle key={a.label} cx="18" cy="18" fill="transparent" r="16"
                      stroke={a.color} strokeDasharray={`${dashLen} ${gapLen}`}
                      strokeDashoffset={segOffset} strokeWidth="4" />
                  );
                })}
              </svg>
              <div className="absolute text-center">
                <p className="text-[14px] font-bold text-ink">{assetAllocation.length > 0 ? "100%" : "—"}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 justify-center">
              {assetAllocation.length > 0 ? (
                assetAllocation.map((a) => (
                  <div key={a.label} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="text-[11px] font-bold">{a.label} {a.percentage.toFixed(1)}%</span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate">No allocation data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <TagsSection tags={tags} />
  </div>
  );
};

export default SummaryCard;
