import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PortfolioOverview from './pages/PortfolioOverview';
import TransactionsPage from './pages/TransactionsPage';
import TradePlanManager from './pages/TradePlanManager';
import ActiveOrders from './pages/ActiveOrders';
import PortfolioAnalyticsDetail from './pages/PortfolioAnalyticsDetail';
import CreateNewPortfolio from './pages/CreateNewPortfolio';
import PortfolioMutualFund from './screens/PortfolioMutualFund';
import PortfolioSpread from './screens/PortfolioSpread';
import PortfolioGrid from './screens/PortfolioGrid';
import AllAssets from './pages/AllAssets';
import RiskAnalytics from './pages/RiskAnalytics';
import GlobalLayout from './components/GlobalLayout';
import './index.css';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route element={<GlobalLayout />}>
            <Route path="/" element={<PortfolioOverview />} />
            <Route path="/trades" element={<TradePlanManager />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/orders" element={<ActiveOrders />} />
            <Route path="/analytics/portfolio/:portfolio_id" element={<PortfolioAnalyticsDetail />} />
            <Route path="/analytics/detail" element={<div className="max-w-[1200px] mx-auto px-6 py-6"><PortfolioGrid /></div>} />
            <Route path="/spread-pairing" element={<PortfolioSpread />} />
            <Route path="/create-portfolio" element={<CreateNewPortfolio />} />
            <Route path="/managed-fund" element={<PortfolioMutualFund />} />
            <Route path="/managed-fund/:portfolioId" element={<PortfolioMutualFund />} />
            <Route path="/all-assets" element={<AllAssets />} />
            <Route path="/risk-analytics" element={<RiskAnalytics />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}