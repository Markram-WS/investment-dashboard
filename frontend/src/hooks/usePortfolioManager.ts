import { useState, useCallback, useEffect } from 'react';
import { PortfolioData } from '../types';
import { api } from '../lib/api';

export const usePortfolioManager = (portfolioId?: number | string) => {
  const [portfolios, setPortfolios] = useState<PortfolioData[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchAnalyticsData = useCallback(async () => {
    try {
      if (portfolioId) {
        const data = await api.getPortfolioAnalytics(portfolioId);
        setPortfolios([data]);
        setSelectedPortfolio(data);
      } else {
        const response = await fetch('/api/v1/analytics/portfolio-grid');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPortfolios(data);
        setSelectedPortfolio((prev) => {
          const updatedSelected = data.find(
            (p: PortfolioData) => prev && p.portfolio_id === prev.portfolio_id,
          );
          return updatedSelected || (data.length > 0 ? data[0] : null);
        });
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  return {
    portfolios,
    selectedPortfolio,
    setSelectedPortfolio,
    loading,
    error,
    lastUpdated,
    fetchAnalyticsData,
  };
};