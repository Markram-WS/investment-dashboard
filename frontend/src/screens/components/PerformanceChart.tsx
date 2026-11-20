import { LineChart } from "ztd-charts";
import { useMemo, type FC } from "react";
import type { PerformanceResult } from "../../lib/api";
import useChartTheme from "../../hooks/useChartTheme";

interface PerformanceChartProps {
  data?: PerformanceResult | null;
  viewMode: "equity" | "payoff";
}

const PerformanceChart: FC<PerformanceChartProps> = ({ data, viewMode }) => {
  const theme = useChartTheme();
  // Signed meaning, not a brand hue: green above break-even, red below.
  const equityTheme = useMemo(
    () => ({ ...theme, accent: "#00b473", accentText: "#00817A" }),
    [theme]
  );
  const points = data?.equity_curve;

  if (!Array.isArray(points) || points.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ paddingTop: 32, paddingBottom: 32 }}>
        <span style={{ fontSize: 12, color: "var(--color-slate)" }}>No trade data yet</span>
      </div>
    );
  }

  // The payoff view is owned by PayoffChart; a stray payoff request renders nothing.
  if (viewMode !== "equity") return null;

  return (
    <LineChart
      data={points}
      x="date"
      xType="date"
      y="cumulative_pl"
      height={220}
      area
      signColors
      baseline={0}
      downColor="#e74c3c"
      curve="linear"
      referenceLines={[{ y: 0, label: "Break-even" }]}
      brush="zoom"
      format={{ style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }}
      theme={equityTheme}
      ariaLabel="Equity curve — cumulative P/L by date"
    />
  );
};

export default PerformanceChart;
