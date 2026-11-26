import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ManagedFund from './PortfolioMutualFund';

const apiMock = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  mfSettings: vi.fn(),
  mfHoldings: vi.fn(),
  mfOrders: vi.fn(),
  mfHistory: vi.fn(),
  mfAlerts: vi.fn(),
  mfCalculateRebalance: vi.fn(),
  mfCreateOrder: vi.fn(),
}));

vi.mock('../lib/api', () => ({ api: apiMock }));

const portfolio = {
  portfolio_id: 7,
  portfolio_name: 'Test Fund',
  port_type: 'Managed Fund',
  current_nav: 1000,
  available_cash: 100,
  risk_status: null,
  cash_buffer_limit: 0,
  margin_locked: 0,
  last_rebalance_date: null,
  tags: null,
};

const settings = {
  id: 1,
  portfolio_id: 7,
  target_ratio: null,
  allocation_mode: 'neutral',
  global_profit_threshold: 0,
  total_invested: 0,
  last_rebalance_date: null,
};

const renderScreen = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ManagedFund portfolioId="7" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PortfolioMutualFund rebalance errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getPortfolio.mockResolvedValue(portfolio);
    apiMock.mfSettings.mockResolvedValue(settings);
    apiMock.mfHoldings.mockResolvedValue([]);
    apiMock.mfOrders.mockResolvedValue([]);
    apiMock.mfHistory.mockResolvedValue([]);
    apiMock.mfAlerts.mockResolvedValue({ alerts: [] });
  });

  it('renders the 422 detail and never the already-balanced message', async () => {
    apiMock.mfCalculateRebalance.mockRejectedValue(Object.assign(new Error('API 422'), {
      status: 422,
      body: JSON.stringify({ detail: 'Weighted sell exceeds the value of SCBSEMI(E)' }),
    }));

    renderScreen();
    const buttons = await screen.findAllByRole('button', { name: 'Rebalance' });
    fireEvent.click(buttons[0]);

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Weighted sell exceeds the value of SCBSEMI(E)');
    expect(screen.queryByText(/already balanced/i)).toBeNull();
  });

  it('falls back to a generic HTTP message for a non-JSON error body', async () => {
    apiMock.mfCalculateRebalance.mockRejectedValue(Object.assign(new Error('API 422'), {
      status: 422,
      body: 'unprocessable entity',
    }));

    renderScreen();
    const buttons = await screen.findAllByRole('button', { name: 'Rebalance' });
    fireEvent.click(buttons[0]);

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Rebalance calculation failed (HTTP 422)');
    expect(screen.queryByText(/already balanced/i)).toBeNull();
  });
});
