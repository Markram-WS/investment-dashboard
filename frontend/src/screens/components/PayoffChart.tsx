import React, { useMemo, useState, useRef, useCallback } from "react";
import { SpreadOrder } from "../../types";
import type { OptionRow } from "./OptionsStrategyTable";

interface PayoffChartProps {
  activeOrders: SpreadOrder[];
  strategyRows: OptionRow[];
  ivMode: boolean;
  minPrice: number;
  maxPrice: number;
  activeIVs: Record<string, number>;
}

function normCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function bsPrice(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean): number {
  if (sigma <= 0 || T <= 0) return isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return isCall
    ? S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
    : K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

function calcLegPL(S: number, leg: { side: string; type: string; strike: number; premium: number; qty: number }, optionValue: number): number {
  const sideMult = leg.side === "LONG" ? 1 : -1;
  return leg.qty * (optionValue - leg.premium) * sideMult;
}

function calcIntrinsic(S: number, K: number, isCall: boolean): number {
  return isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
}

function calcBS(S: number, K: number, T: number, sigma: number, isCall: boolean): number {
  return bsPrice(S, K, T, 0.05, sigma, isCall);
}

function findBreakEvens(prices: number[], pls: number[]): number[] {
  const be: number[] = [];
  for (let i = 1; i < pls.length; i++) {
    if ((pls[i - 1] <= 0 && pls[i] >= 0) || (pls[i - 1] >= 0 && pls[i] <= 0)) {
      const ratio = -pls[i - 1] / (pls[i] - pls[i - 1]);
      be.push(prices[i - 1] + ratio * (prices[i] - prices[i - 1]));
    }
  }
  return be;
}

function roundUp10(n: number): number { return Math.ceil(n / 10) * 10; }

interface LegData {
  side: string; type: string; strike: number; premium: number;
  qty: number; expiry: string | null; iv: number; source: string;
}

const MARGIN = { top: 24, right: 24, bottom: 40, left: 60 };
const WIDTH = 700;
const HEIGHT = 300;
const CHART_W = WIDTH - MARGIN.left - MARGIN.right;
const CHART_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const NUM_POINTS = 200;

interface TooltipData { x: number; y: number; price: number; pl: number; plIv?: number; }

const PayoffChart: React.FC<PayoffChartProps> = ({ activeOrders, strategyRows, ivMode, minPrice, maxPrice, activeIVs }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const legs = useMemo(() => {
    const result: LegData[] = [];
    for (const o of activeOrders) {
      if (o.contract_type !== 'option') continue;
      const strike = o.strike_price != null ? Number(o.strike_price) : 0;
      const premium = o.entry_price != null ? Number(o.entry_price) : 0;
      const qty = Number(o.qty) || 0;
      if (!strike) continue;
      const side = (o.side || "").toUpperCase() === "BUY" || (o.side || "").toUpperCase() === "LONG" ? "LONG" : "SHORT";
      result.push({ side, type: (o.option_type || "Call") as "Call" | "Put", strike, premium, qty, expiry: o.expiry_date || null, iv: activeIVs[o.order_id] || 0, source: "active" });
    }
    for (const r of strategyRows) {
      const strike = parseFloat(r.strike);
      const premium = parseFloat(r.price);
      const qty = parseInt(r.qty) || 0;
      if (!strike || !premium || !qty) continue;
      result.push({ side: r.side, type: r.type, strike, premium, qty, expiry: r.expiry || null, iv: parseFloat(r.iv) || 0, source: "strategy" });
    }
    return result;
  }, [activeOrders, strategyRows, activeIVs]);

  const { prices, plValues, ivPlValues, bePoints, ivBePoints, maxPl, minPl, step } = useMemo(() => {
    if (legs.length === 0) return { prices: [], plValues: [], ivPlValues: [], bePoints: [], ivBePoints: [], maxPl: 100, minPl: -100, step: 1 };

    const strikes = legs.map(l => l.strike).filter(s => s > 0);
    const maxStrike = Math.max(...strikes);

    let lo = minPrice;
    let hi = maxPrice;
    if (lo >= hi) { lo = 0; hi = roundUp10(maxStrike * 3); }

    const s = (hi - lo) / NUM_POINTS;
    if (s <= 0) return { prices: [], plValues: [], ivPlValues: [], bePoints: [], ivBePoints: [], maxPl: 100, minPl: -100, step: 1 };

    const pricesArr: number[] = [];
    const plArr: number[] = [];
    const ivPlArr: number[] = [];
    for (let p = lo; p <= hi; p += s) {
      pricesArr.push(Math.round(p * 100) / 100);
      let t1 = 0, t2 = 0;
      for (const leg of legs) {
        const K = leg.strike;
        if (!K || K <= 0) continue;
        const isCall = leg.type === "Call";
        const T = leg.expiry ? Math.max((new Date(leg.expiry).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 0) : 0;
        const sigma = (leg.iv || 0) / 100;
        t1 += calcLegPL(p, leg, calcIntrinsic(p, K, isCall));
        t2 += calcLegPL(p, leg, calcBS(p, K, T, sigma, isCall));
      }
      plArr.push(t1);
      ivPlArr.push(t2);
    }

    const be = findBreakEvens(pricesArr, plArr);
    const ivBe = findBreakEvens(pricesArr, ivPlArr);
    const allPls = [...plArr, ...ivPlArr];
    const mx = Math.max(Math.abs(Math.max(...allPls, 1)), Math.abs(Math.min(...allPls, -1))) * 1.1;
    const mn = -mx;

    return { prices: pricesArr, plValues: plArr, ivPlValues: ivPlArr, bePoints: be, ivBePoints: ivBe, maxPl: mx, minPl: mn, step: s };
  }, [legs, ivMode, minPrice, maxPrice, activeOrders]);

  const toX = useCallback((price: number) => {
    const lo = minPrice < maxPrice ? minPrice : 0;
    const hi = minPrice < maxPrice ? maxPrice : roundUp10(Math.max(...legs.map(l => l.strike).filter(s => s > 0), 1) * 3);
    return MARGIN.left + ((price - lo) / (hi - lo)) * CHART_W;
  }, [minPrice, maxPrice, legs]);

  const toY = useCallback((pl: number) => {
    const range = maxPl - minPl || 1;
    return MARGIN.top + CHART_H - ((pl - minPl) / range) * CHART_H;
  }, [maxPl, minPl]);

  const baselineY = toY(0);

  const linePath = useMemo(() => {
    if (prices.length === 0) return "";
    return prices.map((p, i) => {
      const x = toX(p); const y = toY(plValues[i]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [prices, plValues, toX, toY]);

  const ivLinePath = useMemo(() => {
    if (prices.length === 0 || !ivMode) return "";
    return prices.map((p, i) => {
      const x = toX(p); const y = toY(ivPlValues[i]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [prices, ivPlValues, ivMode, toX, toY]);

  const fillPath = useMemo(() => {
    if (prices.length === 0) return "";
    const firstX = toX(prices[0]); const lastX = toX(prices[prices.length - 1]);
    const line = prices.map((p, i) => {
      const x = toX(p); const y = toY(plValues[i]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `${line} L${lastX.toFixed(1)},${baselineY.toFixed(1)} L${firstX.toFixed(1)},${baselineY.toFixed(1)} Z`;
  }, [prices, plValues, toX, toY, baselineY]);

  const baselineRatio = Math.max(0, Math.min(1, (baselineY - MARGIN.top) / CHART_H));

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || prices.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseChartX = mouseX - MARGIN.left;
    if (mouseChartX < 0 || mouseChartX > CHART_W) { setTooltip(null); return; }
    const lo = minPrice < maxPrice ? minPrice : 0;
    const hi = minPrice < maxPrice ? maxPrice : roundUp10(Math.max(...legs.map(l => l.strike).filter(s => s > 0), 1) * 3);
    const price = lo + (mouseChartX / CHART_W) * (hi - lo);
    const idx = Math.round((price - lo) / step);
    const clampedIdx = Math.max(0, Math.min(idx, plValues.length - 1));
    setTooltip({
      x: mouseX, y: e.clientY - rect.top,
      price: prices[clampedIdx], pl: plValues[clampedIdx],
      plIv: ivMode ? ivPlValues[clampedIdx] : undefined,
    });
  }, [prices, plValues, ivPlValues, minPrice, maxPrice, step, legs, ivMode, CHART_W]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (legs.length === 0) {
    return <div className="flex items-center justify-center h-48 text-xs text-slate">No option legs to display. Add option orders or use Options Strategy table.</div>;
  }

  if (prices.length === 0) {
    return <div className="flex items-center justify-center h-48 text-xs text-slate">Adjust Min/Max price range to generate the chart.</div>;
  }

  const lo = minPrice < maxPrice ? minPrice : 0;
  const hi = minPrice < maxPrice ? maxPrice : roundUp10(Math.max(...legs.map(l => l.strike).filter(s => s > 0), 1) * 3);

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <defs>
          <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
            <stop offset={`${Math.max(0, baselineRatio - 0.01) * 100}%`} stopColor="#3B82F6" stopOpacity="0" />
            <stop offset={`${baselineRatio * 100}%`} stopColor="#3B82F6" stopOpacity="0" />
            <stop offset={`${baselineRatio * 100}%`} stopColor="#EF4444" stopOpacity="0" />
            <stop offset={`${Math.min(1, baselineRatio + 0.01) * 100}%`} stopColor="#EF4444" stopOpacity="0" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fillAbove" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DCFCE7" stopOpacity="0.6" />
            <stop offset={`${baselineRatio * 100}%`} stopColor="#DCFCE7" stopOpacity="0" />
            <stop offset={`${baselineRatio * 100}%`} stopColor="#FEE2E2" stopOpacity="0" />
            <stop offset="100%" stopColor="#FEE2E2" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = MARGIN.top + CHART_H * (1 - f);
          const val = minPl + (maxPl - minPl) * f;
          return (
            <g key={f}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + CHART_W} y2={y} stroke={f === 0 || f === 1 ? "var(--color-hairline)" : "var(--color-hairline-soft)"} strokeWidth="1" />
              <text x={MARGIN.left - 6} y={y + 3} textAnchor="end" className="text-[9px]" fill="var(--color-slate)">{val.toFixed(0)}</text>
            </g>
          );
        })}
        {[0.25, 0.5, 0.75].map((f) => {
          const x = MARGIN.left + CHART_W * f;
          return <line key={`v${f}`} x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + CHART_H} stroke="var(--color-hairline-soft)" strokeWidth="1" />;
        })}

        {/* X-axis price labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const x = MARGIN.left + CHART_W * f;
          const val = lo + (hi - lo) * f;
          return (
            <g key={`xlabel-${f}`}>
              <text x={x} y={MARGIN.top + CHART_H + 12} textAnchor="middle" className="text-[8px]" fill="var(--color-slate)">{val.toFixed(0)}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={fillPath} fill="url(#fillAbove)" />

        {/* Baseline */}
        <line x1={MARGIN.left} y1={baselineY} x2={MARGIN.left + CHART_W} y2={baselineY} stroke="var(--color-hairline)" strokeWidth="1.5" strokeDasharray="6,4" />

        {/* IV line (when IV mode ON) */}
        {ivMode && ivLinePath && (
          <path d={ivLinePath} fill="none" stroke="var(--color-brand-teal)" strokeWidth="1.5" strokeDasharray="6,3" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Intrinsic P/L line */}
        <path d={linePath} fill="none" stroke="var(--color-brand-blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Break Event */}
        {(() => {
          const bePrice = ivMode && ivBePoints.length > 0 ? ivBePoints[0] : bePoints.length > 0 ? bePoints[0] : null;
          if (bePrice === null || bePrice < lo || bePrice > hi) return null;
          const x = toX(bePrice);
          return (
            <g>
              <rect x={x - 38} y={MARGIN.top - 16} width="76" height="14" rx="3" fill="var(--color-warning)" />
              <text x={x} y={MARGIN.top - 6} textAnchor="middle" className="text-[8px]" fill="white" fontWeight="600">Break Event: {bePrice.toFixed(0)}</text>
            </g>
          );
        })()}

        {/* Break-even (intrinsic) */}
        {bePoints.map((be, i) => {
          const x = toX(be);
          return (
            <g key={`be-${i}`}>
              <circle cx={x} cy={baselineY} r="4" fill="var(--color-warning)" stroke="white" strokeWidth="2" />
              <rect x={x - 22} y={baselineY + 8} width="44" height="14" rx="3" fill="var(--color-warning)" />
              <text x={x} y={baselineY + 18} textAnchor="middle" className="text-[8px]" fill="white" fontWeight="600">BE: {be.toFixed(0)}</text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={MARGIN.left} y1={MARGIN.top + CHART_H} x2={MARGIN.left + CHART_W} y2={MARGIN.top + CHART_H} stroke="var(--color-hairline)" strokeWidth="1" />
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + CHART_H} stroke="var(--color-hairline)" strokeWidth="1" />

        <text x={MARGIN.left + CHART_W / 2} y={HEIGHT - 2} textAnchor="middle" className="text-[10px]" fill="var(--color-slate)" fontWeight="500">Underlying Price</text>
        <text x={14} y={MARGIN.top + CHART_H / 2} textAnchor="middle" transform={`rotate(-90, 14, ${MARGIN.top + CHART_H / 2})`} className="text-[10px]" fill="var(--color-slate)" fontWeight="500">P/L</text>
      </svg>

      {tooltip && (
        <div className="absolute bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded pointer-events-none shadow-lg z-10" style={{ left: Math.min(tooltip.x + 12, WIDTH - 100), top: Math.max(tooltip.y - 40, 0) }}>
          <div>Price: <span className="font-medium">{tooltip.price.toFixed(0)}</span></div>
          <div>
            <span className="text-brand-blue">●</span> Intrinsic:{" "}
            <span className="font-bold" style={{ color: tooltip.pl >= 0 ? "var(--color-success)" : "var(--color-error)" }}>{tooltip.pl >= 0 ? "+" : ""}{tooltip.pl.toFixed(2)}</span>
          </div>
          {tooltip.plIv !== undefined && (
            <div>
              <span className="text-brand-teal">╌</span> BSM IV:{" "}
              <span className="font-bold" style={{ color: tooltip.plIv >= 0 ? "var(--color-success)" : "var(--color-error)" }}>{tooltip.plIv >= 0 ? "+" : ""}{tooltip.plIv.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-5 mt-2 text-[10px] text-slate">
        <span>Legs: <span className="font-medium text-ink">{legs.length}</span> ({legs.filter(l => l.source === "active").length}A, {legs.filter(l => l.source === "strategy").length}S)</span>
        <span><span className="text-brand-blue">●</span> Intrinsic Max: <span className="font-bold text-success">+{Math.max(...plValues, 0).toFixed(0)}</span></span>
        <span>Min: <span className="font-bold text-error">{Math.min(...plValues, 0).toFixed(0)}</span></span>
        {ivMode && (
          <>
            <span><span className="text-brand-teal">╌</span> BSM Max: <span className="font-bold text-success">+{Math.max(...ivPlValues, 0).toFixed(0)}</span></span>
            <span>Min: <span className="font-bold text-error">{Math.min(...ivPlValues, 0).toFixed(0)}</span></span>
          </>
        )}
        {bePoints.length > 0 && <span>BE: <span className="font-medium text-ink">{bePoints.map(b => b.toFixed(0)).join(", ")}</span></span>}
      </div>
    </div>
  );
};

export default PayoffChart;
