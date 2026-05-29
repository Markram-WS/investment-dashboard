import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function AllAssets() {
  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.getAssets(),
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
      <h1 className="text-2xl font-bold text-slate-900 mb-6">All Assets</h1>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Symbol</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Change 24h</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Allocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {assets?.map((asset: any) => (
              <tr key={asset.symbol} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{asset.symbol}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{asset.name}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-900">${asset.price?.toLocaleString()}</td>
                <td className={`px-4 py-3 text-sm text-right ${asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {asset.change24h >= 0 ? '+' : ''}{asset.change24h?.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-sm text-right text-slate-600">{asset.allocation?.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}