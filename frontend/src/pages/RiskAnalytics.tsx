import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function RiskAnalytics() {
  const { data: riskData, isLoading } = useQuery({
    queryKey: ['risk-analytics'],
    queryFn: () => api.getRiskAnalytics(),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-hairline-soft rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-hairline-soft rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-ink mb-6">Risk Analytics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          <h2 className="text-sm font-medium text-slate mb-2">Sharpe Ratio</h2>
          <p className="text-3xl font-bold text-ink">{riskData?.sharpeRatio?.toFixed(2) || 'N/A'}</p>
          <p className="text-xs text-slate mt-1">Risk-adjusted returns</p>
        </div>
        
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          <h2 className="text-sm font-medium text-slate mb-2">Max Drawdown</h2>
          <p className="text-3xl font-bold text-error">{riskData?.maxDrawdown ? `${riskData.maxDrawdown.toFixed(1)}%` : 'N/A'}</p>
          <p className="text-xs text-slate mt-1">Largest peak-to-trough decline</p>
        </div>
        
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          <h2 className="text-sm font-medium text-slate mb-2">Value at Risk (95%)</h2>
          <p className="text-3xl font-bold text-ink">{riskData?.var95 ? `${riskData.var95}%` : 'N/A'}</p>
          <p className="text-xs text-slate mt-1">Maximum expected loss</p>
        </div>
      </div>

      <div className="bg-canvas border border-hairline rounded-lg p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Risk Metrics Breakdown</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-on-surface-variant">Portfolio Beta</span>
              <span className="font-medium text-ink">{riskData?.beta?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="w-full bg-hairline-soft rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((riskData?.beta || 0) * 50, 100)}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-on-surface-variant">Volatility</span>
              <span className="font-medium text-ink">{riskData?.volatility ? `${riskData.volatility}%` : 'N/A'}</span>
            </div>
            <div className="w-full bg-hairline-soft rounded-full h-2">
              <div className="bg-warning h-2 rounded-full" style={{ width: `${Math.min((riskData?.volatility || 0) / 2, 100)}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-on-surface-variant">Correlation to Market</span>
              <span className="font-medium text-ink">{riskData?.correlation ? riskData.correlation.toFixed(2) : 'N/A'}</span>
            </div>
            <div className="w-full bg-hairline-soft rounded-full h-2">
              <div className="bg-accent h-2 rounded-full" style={{ width: `${Math.abs(riskData?.correlation || 0) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}