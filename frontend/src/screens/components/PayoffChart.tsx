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

function niceTicks(lo: number, hi: number, target: number = 5): number[] {
  if (hi <= lo) return [lo];
  const range = hi - lo;
  const raw = range / (target - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step: number;
  if (norm < 1.5) step = mag;
  else if (norm < 3.5) step = 2 * mag;
  else if (norm < 7.5) step = 5 * mag;
  else step = 10 * mag;
  if (range > 100 && step < 10) step = 10;
  if (range > 10 && step < 1) step = 1;
  const start = Math.ceil(lo / step) * step;
  const end = Math.floor(hi / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step * 1e-9; t += step) {
    ticks.push(Math.round(t * 1e9) / 1e9);
  }
  if (ticks.length < 2) {
    ticks.length = 0;
    for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step * 1e-9; t += step) {
      ticks.push(Math.round(t * 1e9) / 1e9);
    }
  }
  return ticks;
}

function roundUp10(n: number): number { return Math.ceil(n / 10) * 10; }

interface LegData {
  side: string; type: string; strike: number; premium: number;
  qty: number; expiry: string | null; iv: number; source: string;
}

const MARGIN = { top: 20, right: 24, bottom: 28, left: 60 };
const WIDTH = 800;
const HEIGHT = 200;
const CHART_W = WIDTH - MARGIN.left - MARGIN.right;
const CHART_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const NUM_POINTS = 200;

interface TooltipData {
  snappedX: number;
  cssY: number;
  containerW: number;
  price: number;
  pl: number;
  plIv?: number;
}

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
    const scaleX = WIDTH / rect.width;
    const vbx = (e.clientX - rect.left) * scaleX;
    const vbxChart = vbx - MARGIN.left;
    if (vbxChart < 0 || vbxChart > CHART_W) { setTooltip(null); return; }
    const lo = minPrice < maxPrice ? minPrice : 0;
    const hi = minPrice < maxPrice ? maxPrice : roundUp10(Math.max(...legs.map(l => l.strike).filter(s => s > 0), 1) * 3);
    const price = lo + (vbxChart / CHART_W) * (hi - lo);
    const idx = Math.round((price - lo) / step);
    const clampedIdx = Math.max(0, Math.min(idx, plValues.length - 1));
    const snappedX = MARGIN.left + (clampedIdx / (prices.length - 1)) * CHART_W;
    setTooltip({
      snappedX, cssY: e.clientY - rect.top, containerW: rect.width,
      price: prices[clampedIdx], pl: plValues[clampedIdx],
      plIv: ivMode ? ivPlValues[clampedIdx] : undefined,
    });
  }, [prices, plValues, ivPlValues, minPrice, maxPrice, step, legs, ivMode]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const lo = minPrice < maxPrice ? minPrice : 0;
  const hi = minPrice < maxPrice ? maxPrice : roundUp10(Math.max(...legs.map(l => l.strike).filter(s => s > 0), 1) * 3);

  const yTicks = useMemo(() => niceTicks(minPl, maxPl, 5), [minPl, maxPl]);
  const xTicks = useMemo(() => niceTicks(lo, hi, 6), [lo, hi]);

  if (legs.length === 0) {
    return <div className="flex items-center justify-center h-40 text-xs text-slate">No option legs to display. Add option orders or use Options Strategy table.</div>;
  }

  if (prices.length === 0) {
    return <div className="flex items-center justify-center h-40 text-xs text-slate">Adjust Min/Max price range to generate the chart.</div>;
  }

  return (
    <div className="flex flex-row gap-4">
      <div className="flex-1 aspect-[4/1] relative">
        <svg ref={svgRef} className="absolute inset-0 w-full h-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
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

          {/* Y-axis grid + labels */}
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <g key={`yt-${tick}`}>
                <line x1={MARGIN.left} y1={y} x2={MARGIN.left + CHART_W} y2={y} stroke="var(--color-hairline)" strokeWidth="1" />
                <text x={MARGIN.left - 6} y={y + 3} textAnchor="end" className="text-[9px]" fill="var(--color-slate)">{tick}</text>
              </g>
            );
          })}

          {/* X-axis grid + labels */}
          {xTicks.map((tick) => {
            const x = toX(tick);
            return (
              <g key={`xt-${tick}`}>
                <line x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + CHART_H} stroke="var(--color-hairline-soft)" strokeWidth="1" />
                <text x={x} y={MARGIN.top + CHART_H + 12} textAnchor="middle" className="text-[8px]" fill="var(--color-slate)">{tick}</text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={fillPath} fill="url(#fillAbove)" />

          {/* Baseline */}
          <line x1={MARGIN.left} y1={baselineY} x2={MARGIN.left + CHART_W} y2={baselineY} stroke="var(--color-hairline)" strokeWidth="1.5" strokeDasharray="6,4" />

          {/* IV line */}
          {ivMode && ivLinePath && (
            <path d={ivLinePath} fill="none" stroke="var(--color-brand-teal)" strokeWidth="1.5" strokeDasharray="6,3" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Intrinsic P/L line */}
          <path d={linePath} fill="none" stroke="var(--color-brand-blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Break-even vertical lines */}
          {(ivMode ? ivBePoints : bePoints).map((be, i) => {
            const x = toX(be);
            if (x < MARGIN.left || x > MARGIN.left + CHART_W) return null;
            return (
              <line key={`be-v-${i}`} x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + CHART_H} stroke="#FCD34D" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
            );
          })}

          {/* Crosshair */}
          {tooltip && (
            <>
              <line x1={tooltip.snappedX} y1={MARGIN.top} x2={tooltip.snappedX} y2={MARGIN.top + CHART_H} stroke="var(--color-slate)" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
              <circle cx={tooltip.snappedX} cy={toY(tooltip.pl)} r="4" fill="var(--color-brand-blue)" stroke="white" strokeWidth="2" />
              {ivMode && tooltip.plIv !== undefined && (
                <circle cx={tooltip.snappedX} cy={toY(tooltip.plIv)} r="4" fill="var(--color-brand-teal)" stroke="white" strokeWidth="2" />
              )}
            </>
          )}

          {/* Axes */}
          <line x1={MARGIN.left} y1={MARGIN.top + CHART_H} x2={MARGIN.left + CHART_W} y2={MARGIN.top + CHART_H} stroke="var(--color-hairline)" strokeWidth="1" />
          <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + CHART_H} stroke="var(--color-hairline)" strokeWidth="1" />

          <text x={MARGIN.left + CHART_W / 2} y={HEIGHT - 2} textAnchor="middle" className="text-[10px]" fill="var(--color-slate)" fontWeight="500">Underlying Price</text>
          <text x={14} y={MARGIN.top + CHART_H / 2} textAnchor="middle" transform={`rotate(-90, 14, ${MARGIN.top + CHART_H / 2})`} className="text-[10px]" fill="var(--color-slate)" fontWeight="500">P/L</text>
        </svg>

        {tooltip && (() => {
          const cssScale = tooltip.containerW / WIDTH;
          const left = Math.min(tooltip.snappedX * cssScale + 12, tooltip.containerW - 100);
          const top = Math.max(tooltip.cssY - 40, 0);
          return (
            <div className="absolute pointer-events-none z-10 bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded shadow-lg" style={{ left, top }}>
              <div>Price: <span className="font-medium">{tooltip.price.toFixed(2)}</span></div>
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
          );
        })()}
      </div>

      <div className="w-36 lg:w-44 shrink-0 flex flex-col justify-center gap-2 text-[10px] text-slate pl-4 border-l border-hairline">
        <div>
          Legs: <span className="font-semibold text-ink">{legs.length}</span>
          <span className="ml-1">({legs.filter(l => l.source === "active").length}A, {legs.filter(l => l.source === "strategy").length}S)</span>
        </div>
        <div>
          <span className="text-brand-blue">●</span>
          <span className="ml-1">Intrinsic</span>
          <div className="ml-3 leading-snug">
            Max: <span className="font-semibold text-success">+{Math.max(...plValues, 0).toFixed(1)}</span>
            <span className="ml-1">Min:</span> <span className="font-semibold text-error">{Math.min(...plValues, 0).toFixed(1)}</span>
          </div>
        </div>
        {ivMode && (
          <div>
            <span className="text-brand-teal">╌</span>
            <span className="ml-1">BSM</span>
            <div className="ml-3 leading-snug">
              Max: <span className="font-semibold text-success">+{Math.max(...ivPlValues, 0).toFixed(1)}</span>
              <span className="ml-1">Min:</span> <span className="font-semibold text-error">{Math.min(...ivPlValues, 0).toFixed(1)}</span>
            </div>
          </div>
        )}
        {(ivMode ? ivBePoints : bePoints).length > 0 && (
          <div>
            BE: <span className="font-semibold text-ink">{(ivMode ? ivBePoints : bePoints).map(b => b.toFixed(1)).join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayoffChart;
