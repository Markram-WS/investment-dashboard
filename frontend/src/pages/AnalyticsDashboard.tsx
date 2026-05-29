import PortfolioAnalyticsGrid from './PortfolioAnalyticsGrid';

export default function AnalyticsDashboard() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Analytics Dashboard</h2>
      <div className="space-y-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">NAV Time Series</h3>
          <p className="text-gray-500">Chart placeholder</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Risk Summary</h3>
          <p className="text-gray-500">Risk metrics placeholder</p>
        </div>
        <PortfolioAnalyticsGrid />
      </div>
    </div>
  );
}