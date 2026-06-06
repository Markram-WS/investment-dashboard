import React, { useRef, useEffect, useState } from "react";

interface PerformanceChartProps {
  data: any;
  viewMode: "equity" | "payoff";
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, viewMode }) => {
  const W = 800, H = 200, PAD = 40;
  const points = viewMode === "equity" ? data.equity_curve : data.payoff_data;
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLen, setPathLen] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLen(pathRef.current.getTotalLength());
    } else {
      setPathLen(0);
    }
  }, [data, viewMode]);

  if (!points || points.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-slate">
        No trade data yet
      </div>
    );
  }

  if (viewMode === "equity") {
    const vals = points.map((p: any) => p.cumulative_pl);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 0);
    const range = max - min || 1;
    const toY = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - min) / range);
    const toX = (i: number) => PAD + (W - 2 * PAD) * (i / (points.length - 1 || 1));

    const pathD = points
      .map((p: any, i: number) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.cumulative_pl)}`)
      .join(" ");
    const areaD = `${pathD} L${toX(points.length - 1)},${H - PAD} L${toX(0)},${H - PAD} Z`;

    const yTicks = [min, (min + max) / 2, max];
    const xLabels = points
      .filter((_: any, i: number) => i % Math.max(1, Math.floor(points.length / 5)) === 0)
      .map((p: any) => ({ label: p.date?.slice(0, 7) || "", x: toX(points.indexOf(p)) }));

    return (
      <div className="h-40 relative">
        <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="perfGrad" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#4262ff" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#4262ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((v) => (
            <line key={v} x1={PAD} x2={W - PAD} y1={toY(v)} y2={toY(v)} stroke="#e0e2e8" strokeWidth="1" />
          ))}
          <path d={areaD} fill="url(#perfGrad)" style={{ animation: 'fadeUp 0.8s ease-out 0.3s both' }} />
          <path ref={pathRef} d={pathD} fill="none" stroke="#4262ff" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              strokeDasharray: pathLen || 2000,
              strokeDashoffset: pathLen || 2000,
              animation: pathLen ? `lineDraw 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards` : 'none',
              ['--path-len' as string]: pathLen || 2000,
            }} />
          {points.map((p: any, i: number) => (
            <circle key={i} cx={toX(i)} cy={toY(p.cumulative_pl)} fill="#4262ff" r="2.5" stroke="#fff" strokeWidth="1.5"
              style={{ animation: `fadeUp 0.4s ease-out ${0.3 + i * 0.03}s both` }} />
          ))}
        </svg>
        <div className="flex justify-between mt-1 text-[10px] font-bold text-slate uppercase tracking-widest px-1">
          {xLabels.map((xl: any, i: number) => <span key={i} style={{ animation: `fadeUp 0.4s ease-out ${0.5 + i * 0.1}s both` }}>{xl.label}</span>)}
        </div>
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[9px] text-slate font-medium py-[2px]">
          <span style={{ animation: 'fadeUp 0.4s ease-out 0.5s both' }}>${max.toLocaleString()}</span>
          <span style={{ animation: 'fadeUp 0.4s ease-out 0.6s both' }}>${min.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  const pls = points.map((p: any) => p.realized_pl);
  const maxAbs = Math.max(...pls.map(Math.abs), 1);
  const barW = Math.max(4, Math.min(20, (W - 2 * PAD) / points.length - 2));

  return (
    <div className="h-40 relative">
      <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="#e0e2e8" strokeWidth="1" />
        <line x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} stroke="#e0e2e8" strokeWidth="1" />
        {points.map((p: any, i: number) => {
          const barH = (Math.abs(p.realized_pl) / maxAbs) * (H / 2 - PAD);
          const x = PAD + (W - 2 * PAD) * (i / (points.length - 1 || 1));
          const y = p.realized_pl >= 0 ? H / 2 - barH : H / 2;
          return (
            <rect key={i} x={x - barW / 2} y={y} width={barW} height={barH || 1}
              fill={p.realized_pl >= 0 ? "#00b473" : "#e74c3c"} rx="1"
              style={{
                transformOrigin: p.realized_pl >= 0 ? `50% ${barH}px` : '50% 0',
                animation: `barGrow 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.04}s forwards`,
              } as any} />
          );
        })}
      </svg>
      <div className="flex justify-between mt-1 text-[10px] font-bold text-slate uppercase tracking-widest px-1">
          {points.filter((_: any, i: number) => i % Math.max(1, Math.floor(points.length / 5)) === 0)
          .map((p: any, i: number) => <span key={i} style={{ animation: `fadeUp 0.4s ease-out ${0.3 + i * 0.1}s both` }}>{(p.date || "").slice(0, 7)}</span>)}
      </div>
    </div>
  );
};

export default PerformanceChart;
