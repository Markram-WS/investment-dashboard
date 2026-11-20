import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { BulletChart, GaugeChart } from 'ztd-charts';
import { api } from '../lib/api';
import PageLayout from '../components/PageLayout';
import PageHeader from '../components/PageHeader';
import useChartTheme from '../hooks/useChartTheme';

/** Panel on the surface body: canvas, 16 radius, 20 padding, flat at rest. */
const panelStyle = {
  background: 'var(--color-canvas)',
  borderRadius: 16,
  padding: 20,
} as const;

const labelStyle = {
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  color: 'var(--color-slate)',
  margin: 0,
} as const;

const captionStyle = {
  fontSize: 'var(--fs-label)',
  color: 'var(--color-slate)',
  margin: '8px 0 0',
  fontVariantNumeric: 'tabular-nums',
} as const;

const missingStyle = {
  height: 132,
  display: 'flex',
  alignItems: 'center',
  fontSize: 'var(--fs-label)',
  color: 'var(--color-slate)',
  fontVariantNumeric: 'tabular-nums',
} as const;

/** Plain decimal, e.g. a beta of 0.92. */
const decimal = (v: number) => v.toFixed(2);

/** The metric is already a 0–100 percentage; keep one decimal. */
const percent = (v: number) => `${v.toFixed(1)}%`;

type RiskLevel = 'safe' | 'watch' | 'bad';

type GaugeSpec = {
  title: string;
  value: number | undefined;
  min: number;
  max: number;
  variant: 'arc' | 'ring' | 'ticks';
  format: (v: number) => string;
  /** Status word and the threshold it comes from, read out under the gauge. */
  statusText: string;
  /** Risk semantics live in the DOM, not in a second chart colour. */
  status: string;
};

/** Status words, sentence case, matching the thresholds used for the dot. */
const STATUS_COPY = {
  sharpe: {
    safe: 'Safe — over 2',
    watch: 'Acceptable — 1 to 2',
    bad: 'Weak — under 1',
  },
  drawdown: {
    safe: 'Safe — under 10%',
    watch: 'Watch — 10% to 25%',
    bad: 'High — over 25%',
  },
  var: {
    safe: 'Safe — under 2%',
    watch: 'Watch — 2% to 5%',
    bad: 'High — over 5%',
  },
} as const;

/** Safe / watch / bad, from the tokens. Used by the 6px caption dot. */
function statusColor(level: RiskLevel) {
  if (level === 'safe') return 'var(--color-brand-teal)';
  if (level === 'watch') return 'var(--color-status-warning)';
  return 'var(--color-danger-text)';
}

type MetricSpec = {
  name: string;
  value: number | undefined;
  target: number;
  range: [number, number, number];
  format: (v: number) => string;
  reference: string;
};

export default function RiskAnalytics() {
  const { data: riskData, isLoading } = useQuery({
    queryKey: ['risk-analytics'],
    queryFn: () => api.getRiskAnalytics(),
  });

  const theme = useChartTheme();
  // Range bands borrow the hairline tokens; the value bar and target stay ink.
  const bulletTheme = useMemo(
    () => ({ ...theme, neutral: theme.line, neutralStrong: theme.neutral }),
    [theme]
  );

  if (isLoading) {
    return (
      <PageLayout>
        <div className="animate-pulse">
          <div className="h-8 bg-hairline-soft rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-hairline-soft rounded"></div>
        </div>
      </PageLayout>
    );
  }

  const sharpeRatio = riskData?.sharpeRatio;
  const maxDrawdown = riskData?.maxDrawdown;
  const var95 = riskData?.var95;
  const beta = riskData?.beta;
  const volatility = riskData?.volatility;
  const correlation = riskData?.correlation;

  const hasSharpe = typeof sharpeRatio === 'number' && Number.isFinite(sharpeRatio);
  const hasDrawdown = typeof maxDrawdown === 'number' && Number.isFinite(maxDrawdown);
  const hasVolatility = typeof volatility === 'number' && Number.isFinite(volatility);
  const hasVar = typeof var95 === 'number' && Number.isFinite(var95);

  const sharpeLevel: RiskLevel | undefined = !hasSharpe
    ? undefined
    : sharpeRatio >= 2
      ? 'safe'
      : sharpeRatio >= 1
        ? 'watch'
        : 'bad';
  const drawdownLevel: RiskLevel | undefined = !hasDrawdown
    ? undefined
    : Math.abs(maxDrawdown) < 10
      ? 'safe'
      : Math.abs(maxDrawdown) < 25
        ? 'watch'
        : 'bad';
  const varLevel: RiskLevel | undefined = !hasVar ? undefined : var95 < 2 ? 'safe' : var95 < 5 ? 'watch' : 'bad';

  const gauges: GaugeSpec[] = [
    {
      title: 'Sharpe ratio',
      value: hasSharpe ? sharpeRatio : undefined,
      min: 0,
      max: 3,
      variant: 'arc',
      format: decimal,
      statusText: sharpeLevel ? STATUS_COPY.sharpe[sharpeLevel] : '',
      status: sharpeLevel ? statusColor(sharpeLevel) : '',
    },
    {
      title: 'Max drawdown',
      value: hasDrawdown ? Math.abs(maxDrawdown) : undefined,
      min: 0,
      max: 50,
      variant: 'ring',
      format: percent,
      statusText: drawdownLevel ? STATUS_COPY.drawdown[drawdownLevel] : '',
      status: drawdownLevel ? statusColor(drawdownLevel) : '',
    },
    {
      title: 'Value at risk (95%)',
      value: hasVar ? var95 : undefined,
      min: 0,
      max: 10,
      variant: 'ticks',
      format: percent,
      statusText: varLevel ? STATUS_COPY.var[varLevel] : '',
      status: varLevel ? statusColor(varLevel) : '',
    },
  ];

  const metrics: MetricSpec[] = [
    {
      name: 'Beta',
      value: typeof beta === 'number' && Number.isFinite(beta) ? beta : undefined,
      target: 1,
      range: [0.8, 1.2, 2],
      format: decimal,
      reference: 'Target 1.0 — market-neutral exposure',
    },
    {
      name: 'Volatility',
      value: hasVolatility ? volatility : undefined,
      target: 20,
      range: [10, 20, 35],
      format: percent,
      reference: 'Target 20% — steady annualised swing',
    },
    {
      name: 'Correlation to market',
      value: typeof correlation === 'number' && Number.isFinite(correlation) ? correlation : undefined,
      target: 0.5,
      range: [0.2, 0.5, 0.8],
      format: decimal,
      reference: 'Target 0.5 — only partial market dependence',
    },
  ];

  // Dominant concern = the worse of drawdown and volatility, scaled to each
  // metric's own reference band so two units can be compared honestly.
  const drawdownScore = hasDrawdown ? Math.abs(maxDrawdown) / 25 : null;
  const volatilityScore = hasVolatility ? volatility / 20 : null;
  const dominantConcern =
    drawdownScore === null || volatilityScore === null
      ? null
      : drawdownScore >= volatilityScore
        ? 'with max drawdown the dominant concern'
        : 'with volatility the dominant concern';

  const takeaway = hasSharpe
    ? `${sharpeRatio >= 1 ? 'Risk-adjusted return is acceptable' : 'Risk-adjusted return is weak'}${dominantConcern ? `, ${dominantConcern}` : ''}.`
    : `Risk-adjusted return has no history yet${dominantConcern ? `, ${dominantConcern}` : ''}.`;

  return (
    <PageLayout>
      <PageHeader title="Risk Analytics" />

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 24, marginBottom: 24 }}>
        {gauges.map((gauge) => (
          <div key={gauge.title} style={panelStyle}>
            <h2 style={labelStyle}>{gauge.title}</h2>
            {gauge.value === undefined ? (
              <div style={missingStyle}>Not enough history yet</div>
            ) : (
              <>
                <GaugeChart
                  value={gauge.value}
                  min={gauge.min}
                  max={gauge.max}
                  variant={gauge.variant}
                  format={gauge.format}
                  height={132}
                  theme={theme}
                  animate
                  ariaLabel={`Gauge: ${gauge.statusText}`}
                />
                <p style={captionStyle}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: gauge.status,
                      marginRight: 6,
                      verticalAlign: 'middle',
                    }}
                  />
                  {gauge.statusText}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={panelStyle}>
        <h2
          className="m-0"
          style={{
            fontSize: 'var(--fs-section)',
            fontWeight: 600,
            lineHeight: 1.3,
            color: 'var(--color-ink)',
          }}
        >
          Risk metrics breakdown
        </h2>

        <div style={{ marginTop: 12 }}>
          {metrics.map((metric) => (
            <div key={metric.name} style={{ marginTop: 8 }}>
              {metric.value === undefined ? (
                <div style={{ ...missingStyle, height: 56 }}>Not enough history yet</div>
              ) : (
                <BulletChart
                  data={[
                    {
                      label: metric.name,
                      value: metric.value,
                      target: metric.target,
                      low: metric.range[0],
                      mid: metric.range[1],
                      high: metric.range[2],
                    },
                  ]}
                  label="label"
                  value="value"
                  target="target"
                  ranges={['low', 'mid', 'high']}
                  height={56}
                  format={metric.format}
                  theme={bulletTheme}
                  animate
                  ariaLabel={`${metric.name} against a target of ${metric.target}`}
                />
              )}
              <p style={captionStyle}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 9,
                    // --color-status-warning as text: yellow itself is invisible on white.
                    background: '#B57F00',
                    marginRight: 6,
                    verticalAlign: '-1px',
                  }}
                />
                {metric.reference}
              </p>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: 'var(--fs-body)',
            color: 'var(--color-ink)',
            margin: '16px 0 0',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {takeaway}
        </p>
      </div>
    </PageLayout>
  );
}
