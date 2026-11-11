import React from "react";
import TagsSection from "./TagsSection";
import { AllocationItem } from "../../types";

interface SummaryCardProps {
  totalValue: number;
  totalCash: number;
  totalNotional: number;
  cashAvailable: number;
  cumulativePl: number;
  plPercent: number;
  availableCash: number;
  marginLocked: number;
  cashBufferLimit: number;
  moneyMarket: number;
  riskStatus: string;
  riskPercent: number | null;
  tags: Record<string, boolean> | null;
  assetAllocation: AllocationItem[];
  onEditPortfolio?: () => void;
}

const R = 16, CIRCUMFERENCE = 2 * Math.PI * R;

const HAIRLINE = "1px solid var(--color-hairline)";
const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--color-slate)", margin: 0 };
const STAT: React.CSSProperties = {
  fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums", color: "var(--color-ink)", lineHeight: 1.15, margin: 0,
};
const CELL: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--color-ink)", margin: 0,
};

const InfoHint: React.FC<{ text: string; maxWidth?: number; align?: "left" | "right" }> = ({ text, maxWidth = 256, align = "left" }) => (
  <span
    className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate text-slate cursor-help text-[9px] font-bold leading-none group"
    title={text}
    aria-label={text}
  >
    i
    <div
      className={`absolute bottom-full mb-2 px-3 py-2 bg-ink text-canvas text-[11px] font-normal leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 hidden md:block ${align === "right" ? "right-0" : "left-0"}`}
      style={{ width: "max-content", maxWidth: `min(${maxWidth}px, calc(100vw - 48px))` }}
    >
      {text}
      <div className={`absolute top-full -mt-px w-2 h-2 bg-ink rotate-45 ${align === "right" ? "right-1" : "left-1"}`}></div>
    </div>
  </span>
);

const SummaryCard: React.FC<SummaryCardProps> = ({
  totalValue, totalCash, totalNotional, cashAvailable, cumulativePl, plPercent, availableCash,
  marginLocked, cashBufferLimit, moneyMarket, riskStatus, riskPercent, tags, assetAllocation,
  onEditPortfolio,
}) => {
  let offset = 0;

  const plColor = cumulativePl >= 0 ? "var(--color-positive-text)" : "var(--color-danger-text)";
  const pctColor = plPercent >= 0 ? "var(--color-positive-text)" : "var(--color-danger-text)";
  const riskValue: number | null =
    typeof riskPercent === "number" && Number.isFinite(riskPercent) ? riskPercent : null;
  const riskColor = riskValue === null
    ? "var(--color-hairline)"
    : riskValue >= 100
      ? "var(--color-brand-teal)"
      : riskValue >= 50
        ? "var(--color-brand-yellow)"
        : "var(--color-danger-text)";

  return (
  <div
    className="col-span-12 lg:col-span-8 flex flex-col"
    style={{ background: "var(--color-canvas)", borderRadius: 16, padding: 24 }}
  >
    <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
      <h3 style={LABEL}>Portfolio summary</h3>
      <button onClick={onEditPortfolio} className="p-1 hover:bg-surface-soft rounded-full transition-colors" title="Edit Portfolio">
        <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
    </div>

    <div
      className="grid grid-cols-1 md:grid-cols-3"
      style={{ gap: 24, paddingBottom: 16, marginBottom: 16, borderBottom: HAIRLINE }}
    >
      <div className="flex flex-col">
        <div className="flex items-center" style={{ ...LABEL, marginBottom: 6, gap: 4 }}>
          Total value
          <InfoHint text="Cash + P/L + MM + Margin + Buffer + Notional" />
        </div>
        <p style={STAT}>${totalValue.toLocaleString()}</p>
        <p className="flex items-center" style={{ fontSize: 12, fontWeight: 500, color: pctColor, marginTop: 6, gap: 4 }}>
          {plPercent >= 0 ? "+" : ""}{plPercent.toFixed(1)}%
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </p>
      </div>
      <div className="flex flex-col">
        <p style={{ ...LABEL, marginBottom: 6 }}>Total P/L</p>
        <p style={{ ...STAT, color: plColor }}>
          {cumulativePl >= 0 ? "+" : ""}${cumulativePl.toLocaleString()}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-slate)", margin: 0, marginTop: 6 }}>All time performance</p>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center" style={{ ...LABEL, marginBottom: 6, gap: 4 }}>
          Cash
          <InfoHint text="Cash + P/L = Net Available" maxWidth={224} align="right" />
        </div>
        <p style={STAT}>${Math.max(0, availableCash).toLocaleString()}</p>
      </div>
    </div>

    <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: HAIRLINE }}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Cash details</p>
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 16 }}>
        <div>
          <p style={{ ...LABEL, marginBottom: 4 }}>Margin locked</p>
          <p style={CELL}>${marginLocked.toLocaleString()}</p>
        </div>
        <div>
          <p style={{ ...LABEL, marginBottom: 4 }}>Cash buffer</p>
          <p style={CELL}>${cashBufferLimit.toLocaleString()}</p>
        </div>
        <div>
          <p style={{ ...LABEL, marginBottom: 4 }}>Money market</p>
          <p style={CELL}>${moneyMarket.toLocaleString()}</p>
        </div>
        <div>
          <div className="flex items-center" style={{ ...LABEL, marginBottom: 4, gap: 4 }}>
            Available cash
            <InfoHint text="Available Cash = Cash + Total P/L" maxWidth={224} align="right" />
          </div>
          <p style={CELL}>${cashAvailable.toLocaleString()}</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 48 }}>
      <div className="flex flex-col">
        <div className="flex items-center" style={{ ...LABEL, marginBottom: 12, gap: 4 }}>
          Buffer coverage
          <InfoHint text="min(100%, (Cash − Margin) ÷ max(Buffer, Margin) × 100)" />
        </div>
        <div className="flex items-center" style={{ gap: 32 }}>
          <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" fill="transparent" r="16" strokeWidth="3" style={{ stroke: "var(--color-hairline-soft)" }} />
              {riskValue !== null && (
                <circle cx="18" cy="18" fill="transparent" r="16" className="donut-animate"
                  style={{ stroke: riskColor }}
                  strokeDasharray={`${(riskValue / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset="0" strokeWidth="4" strokeLinecap="round" />
              )}
            </svg>
            <div className="absolute text-center">
              <p style={STAT}>{riskValue === null ? "—" : `${riskValue.toFixed(0)}%`}</p>
            </div>
          </div>
          <div className="flex flex-col items-start" style={{ gap: 12 }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor }} />
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: riskValue === null ? "var(--color-slate)" : "var(--color-ink)",
              }}>{riskValue === null ? "No risk score yet" : (riskStatus || "Safe")}</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-slate)", margin: 0, maxWidth: 140, lineHeight: 1.5 }}>
              {riskValue === null
                ? "Waiting for a risk score"
                : riskValue >= 100
                  ? "Buffer fully covers exposure"
                  : riskValue >= 50
                    ? "Buffer partially covers exposure"
                    : "Exposure exceeds buffer capacity"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <p style={{ ...LABEL, marginBottom: 12 }}>Asset allocation</p>
        <div className="flex items-center" style={{ gap: 32 }}>
          <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" fill="transparent" r="16" strokeWidth="3" style={{ stroke: "var(--color-hairline-soft)" }} />
              {assetAllocation.map((a) => {
                const dashLen = (a.percentage / 100) * CIRCUMFERENCE;
                const gapLen = CIRCUMFERENCE - dashLen;
                const segOffset = offset;
                offset -= dashLen;
                return (
                  <circle key={a.label} cx="18" cy="18" fill="transparent" r="16" className="donut-animate"
                    stroke={a.color} strokeDasharray={`${dashLen} ${gapLen}`}
                    strokeDashoffset={segOffset} strokeWidth="4" />
                );
              })}
            </svg>
            <div className="absolute text-center">
              <p style={STAT}>{assetAllocation.length > 0 ? "100%" : "—"}</p>
            </div>
          </div>
          <div className="flex flex-col justify-center" style={{ gap: 12 }}>
            {assetAllocation.length > 0 ? (
              assetAllocation.map((a) => (
                <div key={a.label} className="flex items-center" style={{ gap: 8 }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
                    {a.label} {a.percentage.toFixed(1)}%
                  </span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 11, color: "var(--color-slate)", margin: 0 }}>No allocation data</p>
            )}
          </div>
        </div>
      </div>
    </div>

    <TagsSection tags={tags} />
  </div>
  );
};

export default React.memo(SummaryCard);
