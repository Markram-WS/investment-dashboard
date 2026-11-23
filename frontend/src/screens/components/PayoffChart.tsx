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

function calcLegPL(leg: { side: string; type: string; strike: number; premium: number; qty: number }, optionValue: number): number {
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

interface LegData {
  side: string; type: string; strike: number; premium: number;
  qty: number; expiry: string | null; iv: number; source: string;
}

/** A non-option leg (spot/future): linear P/L in the underlying price. */
interface FutureLeg {
  sideSign: 1 | -1;
  entry: number;
  qty: number;
  label: string;
}

interface Range { lo: number; hi: number }

const MARGIN = { top: 18, right: 16, bottom: 34, left: 56 };
const WIDTH = 480;
const HEIGHT = 356;
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
  plFutures: number;
  plOptions: number;
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

  const futureLegs = useMemo(() => {
    const result: FutureLeg[] = [];
    for (const o of activeOrders) {
      if (o.contract_type === 'option') continue;
      if (o.entry_price == null) continue;
      const qty = Number(o.qty) || 0;
      if (!qty) continue;
      const side = (o.side || "").toUpperCase();
      result.push({
        sideSign: side === "BUY" || side === "LONG" ? 1 : -1,
        entry: Number(o.entry_price),
        qty,
        label: o.asset_type,
      });
    }
    return result;
  }, [activeOrders]);

  const hasAnyLegs = legs.length > 0 || futureLegs.length > 0;

  /** One x-range for the curve, the tooltip index math and the ticks. */
  const range = useMemo<Range>(() => {
    if (minPrice < maxPrice) return { lo: minPrice, hi: maxPrice };
    const anchors = [
      ...futureLegs.map(f => f.entry),
      ...legs.map(l => l.strike),
    ].filter(v => v > 0);
    if (anchors.length === 0) return { lo: 0, hi: 100 };
    const aMin = Math.min(...anchors);
    const aMax = Math.max(...anchors);
    const pad = Math.max((aMax - aMin) * 0.5, aMax * 0.1, 1);
    return { lo: Math.max(0, aMin - pad), hi: aMax + pad };
  }, [minPrice, maxPrice, futureLegs, legs]);

  const {
    prices, plValues, ivPlValues, futuresPlValues, optionsPlValues,
    bePoints, ivBePoints, maxPl, minPl, step,
  } = useMemo(() => {
    const empty = {
      prices: [] as number[], plValues: [] as number[], ivPlValues: [] as number[],
      futuresPlValues: [] as number[], optionsPlValues: [] as number[],
      bePoints: [] as number[], ivBePoints: [] as number[],
      maxPl: 100, minPl: -100, step: 1,
    };
    if (!hasAnyLegs) return empty;

    const lo = range.lo;
    const hi = range.hi;
    const s = (hi - lo) / NUM_POINTS;
    if (s <= 0) return empty;

    const pricesArr: number[] = [];
    const plArr: number[] = [];
    const ivPlArr: number[] = [];
    const futuresPlArr: number[] = [];
    const optionsPlArr: number[] = [];
    for (let p = lo; p <= hi; p += s) {
      pricesArr.push(Math.round(p * 100) / 100);
      let futuresPl = 0;
      for (const leg of futureLegs) {
        futuresPl += (p - leg.entry) * leg.qty * leg.sideSign;
      }
      let intrinsic = futuresPl, bsm = futuresPl;
      for (const leg of legs) {
        const K = leg.strike;
        if (!K || K <= 0) continue;
        const isCall = leg.type === "Call";
        const T = leg.expiry ? Math.max((new Date(leg.expiry).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 0) : 0;
        const sigma = (leg.iv || 0) / 100;
        intrinsic += calcLegPL(leg, calcIntrinsic(p, K, isCall));
        bsm += calcLegPL(leg, calcBS(p, K, T, sigma, isCall));
      }
      plArr.push(intrinsic);
      ivPlArr.push(bsm);
      futuresPlArr.push(futuresPl);
      optionsPlArr.push(intrinsic - futuresPl);
    }

    const be = findBreakEvens(pricesArr, plArr);
    const ivBe = findBreakEvens(pricesArr, ivPlArr);
    const allPls = [...plArr, ...ivPlArr];
    const mx = Math.max(Math.abs(Math.max(...allPls, 1)), Math.abs(Math.min(...allPls, -1))) * 1.1;
    const mn = -mx;

    return {
      prices: pricesArr, plValues: plArr, ivPlValues: ivPlArr,
      futuresPlValues: futuresPlArr, optionsPlValues: optionsPlArr,
      bePoints: be, ivBePoints: ivBe, maxPl: mx, minPl: mn, step: s,
    };
  }, [hasAnyLegs, range, futureLegs, legs]);

  const toX = useCallback((price: number) => {
    return MARGIN.left + ((price - range.lo) / (range.hi - range.lo)) * CHART_W;
  }, [range]);

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

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || prices.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const vbx = (e.clientX - rect.left) * scaleX;
    const vbxChart = vbx - MARGIN.left;
    if (vbxChart < 0 || vbxChart > CHART_W) { setTooltip(null); return; }
    const price = range.lo + (vbxChart / CHART_W) * (range.hi - range.lo);
    const idx = Math.round((price - range.lo) / step);
    const clampedIdx = Math.max(0, Math.min(idx, plValues.length - 1));
    const snappedX = MARGIN.left + (clampedIdx / (prices.length - 1)) * CHART_W;
    setTooltip({
      snappedX, cssY: e.clientY - rect.top, containerW: rect.width,
      price: prices[clampedIdx], pl: plValues[clampedIdx],
      plIv: ivMode ? ivPlValues[clampedIdx] : undefined,
      plFutures: futuresPlValues[clampedIdx] ?? 0,
      plOptions: optionsPlValues[clampedIdx] ?? 0,
    });
  }, [prices, plValues, ivPlValues, futuresPlValues, optionsPlValues, range, step, ivMode]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const yTicks = useMemo(() => niceTicks(minPl, maxPl, 5), [minPl, maxPl]);
  const xTicks = useMemo(() => niceTicks(range.lo, range.hi, 5), [range]);

  if (!hasAnyLegs) {
    return <div className="flex items-center justify-center h-40 text-xs text-slate">No legs to display. Add orders or use Options Strategy table.</div>;
  }

  if (prices.length === 0) {
    return <div className="flex items-center justify-center h-40 text-xs text-slate">Adjust Min/Max price range to generate the chart.</div>;
  }

  return (
    <div className="flex flex-col" style={{ flex: "1 1 auto", minHeight: 0 }}>
      <div className="relative" style={{ flex: "1 1 auto", minHeight: 0 }}>
        <svg ref={svgRef} className="absolute inset-0 w-full h-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <defs>
            <linearGradient id="gradAbove" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00b473" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#00b473" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradBelow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e74c3c" stopOpacity="0" />
              <stop offset="100%" stopColor="#e74c3c" stopOpacity="0.22" />
            </linearGradient>
            <clipPath id="clipAbove">
              <rect x={MARGIN.left} y={MARGIN.top} width={CHART_W} height={baselineY - MARGIN.top} />
            </clipPath>
            <clipPath id="clipBelow">
              <rect x={MARGIN.left} y={baselineY} width={CHART_W} height={MARGIN.top + CHART_H - baselineY} />
            </clipPath>
          </defs>

          {/* Y-axis grid + labels */}
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <g key={`yt-${tick}`}>
                <line x1={MARGIN.left} y1={y} x2={MARGIN.left + CHART_W} y2={y} stroke="var(--color-hairline)" strokeWidth="1" />
                <text x={MARGIN.left - 6} y={y + 3.5} textAnchor="end" fontSize={10.5} fill="var(--color-slate)">{tick}</text>
              </g>
            );
          })}

          {/* X-axis labels (horizontal gridlines only, like the equity chart) */}
          {xTicks.map((tick) => {
            const x = toX(tick);
            return (
              <g key={`xt-${tick}`}>
                <text x={x} y={MARGIN.top + CHART_H + 15} textAnchor="middle" fontSize={10.5} fill="var(--color-slate)">{tick}</text>
              </g>
            );
          })}

          {/* Area fill */}
          <path className="payoff-area-in" d={fillPath} fill="url(#gradAbove)" clipPath="url(#clipAbove)" />
          <path className="payoff-area-in" d={fillPath} fill="url(#gradBelow)" clipPath="url(#clipBelow)" />

          {/* Baseline */}
          <line x1={MARGIN.left} y1={baselineY} x2={MARGIN.left + CHART_W} y2={baselineY} stroke="var(--color-hairline)" strokeWidth="1.5" strokeDasharray="6,4" />

          {/* IV line */}
          {ivMode && ivLinePath && (
            <path className="payoff-iv-in" d={ivLinePath} fill="none" stroke="var(--color-brand-teal)" strokeWidth="1.5" strokeDasharray="6,3" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
          )}

          {/* Intrinsic P/L line — signed meaning, not a brand hue: green above
              break-even, red below. Two clipped halves of the same path draw as
              one line. pathLength 1 keeps the dash units viewBox-independent. */}
          <path
            className="payoff-line-draw"
            d={linePath}
            fill="none"
            stroke="#00b473"
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            clipPath="url(#clipAbove)"
            pathLength={1}
            style={{ strokeDasharray: "1" }}
          />
          <path
            className="payoff-line-draw"
            d={linePath}
            fill="none"
            stroke="#e74c3c"
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            clipPath="url(#clipBelow)"
            pathLength={1}
            style={{ strokeDasharray: "1" }}
          />

          {/* First plotted point, as on the equity curve */}
          {prices.length > 0 && (
            <circle cx={toX(prices[0])} cy={toY(plValues[0])} r={3.5} fill={plValues[0] >= 0 ? "#00b473" : "#e74c3c"} />
          )}

          {/* Break-even vertical lines — one stable group so the quiet fade
              runs at mount and never replays when the range changes. */}
          <g className="payoff-be-in">
            {(ivMode ? ivBePoints : bePoints).map((be, i) => {
              const x = toX(be);
              if (x < MARGIN.left || x > MARGIN.left + CHART_W) return null;
              return (
                <line key={`be-v-${i}`} x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + CHART_H} stroke="var(--color-slate)" strokeWidth="1" strokeDasharray="4,3" opacity="0.35" />
              );
            })}
          </g>

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

          <text x={MARGIN.left + CHART_W / 2} y={HEIGHT - 4} textAnchor="middle" fontSize={11} fill="var(--color-slate)" fontWeight="500">Futures price</text>
          <text x={15} y={MARGIN.top + CHART_H / 2} textAnchor="middle" transform={`rotate(-90, 15, ${MARGIN.top + CHART_H / 2})`} fontSize={11} fill="var(--color-slate)" fontWeight="500">P/L</text>
        </svg>

        {tooltip && (
          <div className="absolute pointer-events-none z-10 text-[10px] px-2.5 py-1.5 rounded" style={{
            background: "var(--color-ink)",
            color: "var(--color-canvas)",
            left: Math.min(tooltip.snappedX * (tooltip.containerW / WIDTH) + 12, tooltip.containerW - 100),
            top: Math.max(tooltip.cssY - 40, 0),
          }}>
            <div>Price: <span className="font-medium">{tooltip.price.toFixed(2)}</span></div>
            <div>
              <span className="text-brand-blue">●</span> Futures:{" "}
              <span className="font-bold" style={{ color: tooltip.plFutures >= 0 ? "var(--color-success)" : "var(--color-error)" }}>{tooltip.plFutures >= 0 ? "+" : ""}{tooltip.plFutures.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-brand-blue">●</span> Options:{" "}
              <span className="font-bold" style={{ color: tooltip.plOptions >= 0 ? "var(--color-success)" : "var(--color-error)" }}>{tooltip.plOptions >= 0 ? "+" : ""}{tooltip.plOptions.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-brand-blue">●</span> Intrinsic total:{" "}
              <span className="font-bold" style={{ color: tooltip.pl >= 0 ? "var(--color-success)" : "var(--color-error)" }}>{tooltip.pl >= 0 ? "+" : ""}{tooltip.pl.toFixed(2)}</span>
            </div>
            {tooltip.plIv !== undefined && (
              <div>
                <span className="text-brand-teal">╌</span> BSM IV total:{" "}
                <span className="font-bold" style={{ color: tooltip.plIv >= 0 ? "var(--color-success)" : "var(--color-error)" }}>{tooltip.plIv >= 0 ? "+" : ""}{tooltip.plIv.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="flex flex-wrap items-baseline text-[11px] text-slate"
        style={{ marginTop: 6, columnGap: 12, rowGap: 2, lineHeight: 1.45 }}
      >
        <span>
          Legs: <span className="font-semibold text-ink">{legs.length + futureLegs.length}</span>
          <span className="ml-1">
            ({futureLegs.length}F, {legs.filter(l => l.source === "active").length}A, {legs.filter(l => l.source === "strategy").length}S)
          </span>
        </span>
        <span>Curve = futures + options P/L</span>
        <span>
          <span className="text-brand-blue">●</span> Intrinsic Max:{" "}
          <span className="font-semibold text-success">+{Math.max(...plValues, 0).toFixed(1)}</span>
          <span className="ml-1">Min:</span>{" "}
          <span className="font-semibold text-error">{Math.min(...plValues, 0).toFixed(1)}</span>
        </span>
        {ivMode && (
          <span>
            <span className="text-brand-teal">╌</span> BSM Max:{" "}
            <span className="font-semibold text-success">+{Math.max(...ivPlValues, 0).toFixed(1)}</span>
            <span className="ml-1">Min:</span>{" "}
            <span className="font-semibold text-error">{Math.min(...ivPlValues, 0).toFixed(1)}</span>
          </span>
        )}
        {(ivMode ? ivBePoints : bePoints).length > 0 && (
          <span>
            BE:{" "}
            <span className="font-semibold text-ink">
              {(ivMode ? ivBePoints : bePoints).map(b => b.toFixed(1)).join(", ")}
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(PayoffChart);
