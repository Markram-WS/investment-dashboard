import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ManagedFund from './PortfolioMutualFund';

const apiMock = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  mfSettings: vi.fn(),
  mfHoldings: vi.fn(),
  mfOrders: vi.fn(),
  mfHistory: vi.fn(),
  mfUpdateSettings: vi.fn(),
  mfUpdateHolding: vi.fn(),
  updatePortfolio: vi.fn(),
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
  total_invested: 0,
  last_rebalance_date: null,
};

const holdings = [
  {
    holding_id: 1, portfolio_id: 7, asset: 'AAA', qty: 10, avg_entry_price: 10,
    current_price: 10, market_value: 100, unrealized_pl: 0, unrealized_pl_pct: 0,
    rebalance_weight: null, broker_id: null, broker_code: null, underlying: 'VOO',
  },
  {
    holding_id: 2, portfolio_id: 7, asset: 'BBB', qty: 10, avg_entry_price: 10,
    current_price: 10, market_value: 100, unrealized_pl: 0, unrealized_pl_pct: 0,
    rebalance_weight: null, broker_id: null, broker_code: null, underlying: 'QQQ',
  },
];

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
    vi.resetAllMocks();
    apiMock.getPortfolio.mockResolvedValue(portfolio);
    apiMock.mfSettings.mockResolvedValue(settings);
    apiMock.mfHoldings.mockResolvedValue([]);
    apiMock.mfOrders.mockResolvedValue([]);
    apiMock.mfHistory.mockResolvedValue([]);
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

describe('PortfolioMutualFund allocation mode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.getPortfolio.mockResolvedValue(portfolio);
    apiMock.mfSettings.mockResolvedValue(settings);
    apiMock.mfHoldings.mockResolvedValue([]);
    apiMock.mfOrders.mockResolvedValue([]);
    apiMock.mfHistory.mockResolvedValue([]);
    apiMock.mfCalculateRebalance.mockResolvedValue({ recommendations: [], allocation_base: 0 });
  });

  it('persists weight mode from the header toggle and recalculates', async () => {
    const weightSettings = { ...settings, allocation_mode: 'weight', target_ratio: { VOO: 100 } };
    apiMock.mfUpdateSettings.mockResolvedValue(weightSettings);

    renderScreen();
    const weightToggle = await screen.findByRole('button', { name: 'Weight (%)' });
    fireEvent.click(weightToggle);

    await waitFor(() => expect(apiMock.mfUpdateSettings)
      .toHaveBeenCalledWith(7, { allocation_mode: 'weight' }));
    await waitFor(() => expect(apiMock.mfCalculateRebalance).toHaveBeenCalledWith(7, undefined));
    await waitFor(() => expect(weightToggle).toHaveAttribute('aria-pressed', 'true'));
  });

  it('blocks a weight-mode save whose percentages do not sum to 100', async () => {
    apiMock.mfSettings.mockResolvedValue({
      ...settings, allocation_mode: 'weight', target_ratio: { VOO: 80, QQQ: 20 },
    });
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateSettings.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));

    const vooTarget = await screen.findByLabelText('VOO target weight');
    expect(vooTarget).toHaveValue(80);
    fireEvent.change(screen.getByLabelText('QQQ target weight'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Target weights must sum to 100.')).toBeInTheDocument();
    expect(apiMock.mfUpdateSettings).not.toHaveBeenCalled();
  });

  it('surfaces the server detail when the settings update is rejected', async () => {
    apiMock.mfSettings.mockResolvedValue({
      ...settings, allocation_mode: 'weight', target_ratio: { VOO: 60, QQQ: 40 },
    });
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateSettings.mockRejectedValue(Object.assign(new Error('API 400'), {
      status: 400,
      body: JSON.stringify({ detail: 'Unsupported allocation mode' }),
    }));

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    await screen.findByLabelText('VOO target weight');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Unsupported allocation mode')).toBeInTheDocument();
  });

  it('persists neutral-mode target percentages typed in the edit modal', async () => {
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});
    apiMock.mfUpdateSettings.mockResolvedValue({
      ...settings, target_ratio: { VOO: 60, QQQ: 40 },
    });

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));

    fireEvent.change(await screen.findByLabelText('VOO target weight'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('QQQ target weight'), { target: { value: '40' } });
    expect(screen.getByText(/sum 100 \/ 100/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(apiMock.mfUpdateSettings).toHaveBeenCalledWith(7, {
      allocation_mode: 'neutral',
      target_ratio: { VOO: 60, QQQ: 40 },
    }));
  });

  it('opens the edit modal when the weight-mode toggle is rejected', async () => {
    apiMock.mfSettings.mockResolvedValue({
      ...settings, target_ratio: { VOO: 0, QQQ: 0 },
    });
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.mfUpdateSettings.mockRejectedValue(Object.assign(new Error('API 400'), {
      status: 400,
      body: JSON.stringify({ detail: 'Target weights must sum to 100' }),
    }));

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Weight (%)' }));

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Target weights must sum to 100');
    expect(await screen.findByLabelText('VOO target weight')).toHaveValue(0);
  });
});
