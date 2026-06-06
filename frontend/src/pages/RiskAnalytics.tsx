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
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Risk Analytics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-canvas border border-slate-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Sharpe Ratio</h3>
          <p className="text-3xl font-bold text-slate-900">{riskData?.sharpeRatio?.toFixed(2) || 'N/A'}</p>
          <p className="text-xs text-slate-500 mt-1">Risk-adjusted returns</p>
        </div>
        
        <div className="bg-canvas border border-slate-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Max Drawdown</h3>
          <p className="text-3xl font-bold text-red-600">{riskData?.maxDrawdown ? `${riskData.maxDrawdown.toFixed(1)}%` : 'N/A'}</p>
          <p className="text-xs text-slate-500 mt-1">Largest peak-to-trough decline</p>
        </div>
        
        <div className="bg-canvas border border-slate-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Value at Risk (95%)</h3>
          <p className="text-3xl font-bold text-slate-900">{riskData?.var95 ? `${riskData.var95}%` : 'N/A'}</p>
          <p className="text-xs text-slate-500 mt-1">Maximum expected loss</p>
        </div>
      </div>

      <div className="bg-canvas border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Metrics Breakdown</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">Portfolio Beta</span>
              <span className="font-medium text-slate-900">{riskData?.beta?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((riskData?.beta || 0) * 50, 100)}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">Volatility</span>
              <span className="font-medium text-slate-900">{riskData?.volatility ? `${riskData.volatility}%` : 'N/A'}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min((riskData?.volatility || 0) / 2, 100)}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">Correlation to Market</span>
              <span className="font-medium text-slate-900">{riskData?.correlation ? riskData.correlation.toFixed(2) : 'N/A'}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.abs(riskData?.correlation || 0) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}