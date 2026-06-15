import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { NotificationProvider } from './contexts/NotificationContext';
import { lazy, Suspense } from 'react';
import GlobalLayout from './components/GlobalLayout';
import './index.css';

const PortfolioOverview = lazy(() => import('./pages/PortfolioOverview'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const TradePlanManager = lazy(() => import('./pages/TradePlanManager'));
const ActiveOrders = lazy(() => import('./pages/ActiveOrders'));
const PortfolioAnalyticsDetail = lazy(() => import('./pages/PortfolioAnalyticsDetail'));
const CreateNewPortfolio = lazy(() => import('./pages/CreateNewPortfolio'));
const PortfolioMutualFund = lazy(() => import('./screens/PortfolioMutualFund'));
const PortfolioGrid = lazy(() => import('./screens/PortfolioGrid'));
const AllAssets = lazy(() => import('./pages/AllAssets'));
const RiskAnalytics = lazy(() => import('./pages/RiskAnalytics'));

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
      <Router>
        <DndProvider backend={HTML5Backend}>
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" /></div>}>
        <Routes>
          <Route element={<GlobalLayout />}>
            <Route path="/" element={<PortfolioOverview />} />
            <Route path="/trades" element={<TradePlanManager />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/orders" element={<ActiveOrders />} />
            <Route path="/analytics/portfolio/:portfolio_id" element={<PortfolioAnalyticsDetail />} />
            <Route path="/analytics/detail" element={<div className="max-w-[1200px] mx-auto px-6 py-6"><PortfolioGrid /></div>} />
            <Route path="/create-portfolio" element={<CreateNewPortfolio />} />
            <Route path="/managed-fund" element={<PortfolioMutualFund />} />
            <Route path="/managed-fund/:portfolioId" element={<PortfolioMutualFund />} />
            <Route path="/all-assets" element={<AllAssets />} />
            <Route path="/risk-analytics" element={<RiskAnalytics />} />
          </Route>
        </Routes>
        </Suspense>
        </DndProvider>
      </Router>
      </NotificationProvider>
    </QueryClientProvider>
  );
}