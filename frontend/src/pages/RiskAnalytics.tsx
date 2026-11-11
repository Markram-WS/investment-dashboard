import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PageLayout from '../components/PageLayout';
import PageHeader from '../components/PageHeader';

/** Panel on the surface body: canvas, 16 radius, 20 padding, flat at rest. */
const panelStyle = {
  background: 'var(--color-canvas)',
  borderRadius: 16,
  padding: 20,
} as const;

const labelStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-slate)',
  margin: 0,
} as const;

const valueStyle = {
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-ink)',
  margin: '6px 0 0',
} as const;

const subStyle = {
  fontSize: 12,
  color: 'var(--color-slate)',
  margin: '4px 0 0',
} as const;

const metricValueStyle = {
  fontSize: 15,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-ink)',
} as const;

export default function RiskAnalytics() {
  const { data: riskData, isLoading } = useQuery({
    queryKey: ['risk-analytics'],
    queryFn: () => api.getRiskAnalytics(),
  });

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

  return (
    <PageLayout>
      <PageHeader title="Risk Analytics" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 24, marginBottom: 48 }}>
        <div style={panelStyle}>
          <h2 style={labelStyle}>Sharpe ratio</h2>
          <p style={valueStyle}>{riskData?.sharpeRatio?.toFixed(2) || 'N/A'}</p>
          <p style={subStyle}>Risk-adjusted returns</p>
        </div>

        <div style={panelStyle}>
          <h2 style={labelStyle}>Max drawdown</h2>
          <p style={{ ...valueStyle, color: 'var(--color-danger-text)' }}>{riskData?.maxDrawdown ? `${riskData.maxDrawdown.toFixed(1)}%` : 'N/A'}</p>
          <p style={subStyle}>Largest peak-to-trough decline</p>
        </div>

        <div style={panelStyle}>
          <h2 style={labelStyle}>Value at risk (95%)</h2>
          <p style={valueStyle}>{riskData?.var95 ? `${riskData.var95}%` : 'N/A'}</p>
          <p style={subStyle}>Maximum expected loss</p>
        </div>
      </div>

      <div style={panelStyle}>
        <h2
          className="m-0"
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            lineHeight: 1.3,
            color: 'var(--color-ink)',
            marginBottom: 20,
          }}
        >
          Risk metrics breakdown
        </h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1" style={{ alignItems: 'baseline', gap: 12 }}>
              <span style={labelStyle}>Portfolio beta</span>
              <span style={metricValueStyle}>{riskData?.beta?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="w-full bg-hairline-soft rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((riskData?.beta || 0) * 50, 100)}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1" style={{ alignItems: 'baseline', gap: 12 }}>
              <span style={labelStyle}>Volatility</span>
              <span style={metricValueStyle}>{riskData?.volatility ? `${riskData.volatility}%` : 'N/A'}</span>
            </div>
            <div className="w-full bg-hairline-soft rounded-full h-2">
              <div className="bg-warning h-2 rounded-full" style={{ width: `${Math.min((riskData?.volatility || 0) / 2, 100)}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1" style={{ alignItems: 'baseline', gap: 12 }}>
              <span style={labelStyle}>Correlation to market</span>
              <span style={metricValueStyle}>{riskData?.correlation ? riskData.correlation.toFixed(2) : 'N/A'}</span>
            </div>
            <div className="w-full bg-hairline-soft rounded-full h-2">
              <div className="bg-accent h-2 rounded-full" style={{ width: `${Math.abs(riskData?.correlation || 0) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
