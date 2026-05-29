import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PortfolioOverview from './pages/PortfolioOverview';
import TransactionsPage from './pages/TransactionsPage';
import TradePlanManager from './pages/TradePlanManager';
import ActiveOrders from './pages/ActiveOrders';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import PortfolioAnalyticsDetail from './pages/PortfolioAnalyticsDetail';
import CreateNewPortfolio from './pages/CreateNewPortfolio';
import ManagedFund from './screens/ManagedFund';
import SpreadPairing from './screens/SpreadPairing';
import PortfolioAnalytics from './screens/PortfolioAnalytics';
import AllAssets from './pages/AllAssets';
import RiskAnalytics from './pages/RiskAnalytics';
import Navigation from './components/Navigation';
import './index.css';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Navigation />
        <Routes>
        <Route path="/" element={<PortfolioOverview />} />
        <Route path="/trades" element={<TradePlanManager />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/orders" element={<ActiveOrders />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/analytics/portfolio/:portfolio_id" element={<PortfolioAnalyticsDetail />} />
        <Route path="/analytics/detail" element={<PortfolioAnalytics />} />
        <Route path="/spread-pairing" element={<SpreadPairing />} />
        <Route path="/create-portfolio" element={<CreateNewPortfolio />} />
        <Route path="/managed-fund" element={<ManagedFund />} />
        <Route path="/managed-fund/:portfolioId" element={<ManagedFund />} />
        <Route path="/all-assets" element={<AllAssets />} />
        <Route path="/risk-analytics" element={<RiskAnalytics />} />
      </Routes>
    </Router>
  </QueryClientProvider>
  );
}