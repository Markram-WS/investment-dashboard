import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
    const card = await screen.findByRole('region', { name: 'Rebalance' });
    fireEvent.click(within(card).getByRole('button', { name: 'Rebalance' }));

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
    const card = await screen.findByRole('region', { name: 'Rebalance' });
    fireEvent.click(within(card).getByRole('button', { name: 'Rebalance' }));

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Rebalance calculation failed (HTTP 422)');
    expect(screen.queryByText(/already balanced/i)).toBeNull();
  });
});

describe('PortfolioMutualFund header actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.getPortfolio.mockResolvedValue(portfolio);
    apiMock.mfSettings.mockResolvedValue(settings);
    apiMock.mfHoldings.mockResolvedValue([]);
    apiMock.mfOrders.mockResolvedValue([]);
    apiMock.mfHistory.mockResolvedValue([]);
  });

  it('keeps the Rebalance button in the card only, not in the page header', async () => {
    renderScreen();

    const editButton = await screen.findByRole('button', { name: 'Edit portfolio' });
    const header = editButton.closest('header');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).queryByRole('button', { name: 'Rebalance' })).toBeNull();
    expect(within(header as HTMLElement).getByRole('button', { name: 'Refresh' })).toBeInTheDocument();

    const card = screen.getByRole('region', { name: 'Rebalance' });
    expect(within(card).getByRole('button', { name: 'Rebalance' })).toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: 'Rebalance' })).toHaveLength(1);
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
    apiMock.mfCalculateRebalance.mockResolvedValue({ recommendations: [], groups: [], allocation_base: 0 });
  });

  it('switches to Weight (%) in the edit modal and saves the entered targets', async () => {
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});
    apiMock.mfUpdateSettings.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Weight (%)' }));
    fireEvent.change(within(dialog).getByLabelText('VOO target weight'), { target: { value: '60' } });
    fireEvent.change(within(dialog).getByLabelText('QQQ target weight'), { target: { value: '40' } });
    expect(within(dialog).getByText(/sum 100 \/ 100/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(apiMock.mfUpdateSettings).toHaveBeenCalledWith(7, {
      allocation_mode: 'weight',
      target_ratio: { VOO: 60, QQQ: 40 },
    }));
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

  it('shows neutral group shares read-only and saves neutral mode', async () => {
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});
    apiMock.mfUpdateSettings.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    expect(within(dialog).getAllByText('50.0% share')).toHaveLength(2);
    expect(within(dialog).queryByLabelText('VOO target weight')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(apiMock.mfUpdateSettings).toHaveBeenCalledWith(7, {
      allocation_mode: 'neutral',
      target_ratio: null,
    }));
  });

  it('groups holdings under their group row with equal-split defaults', async () => {
    const sameGroupHoldings = [
      {
        ...holdings[0], holding_id: 1, asset: 'SCBS&P500-SSF',
        rebalance_weight: null, underlying: 'S&P500',
      },
      {
        ...holdings[1], holding_id: 2, asset: 'SCBS&P500A',
        rebalance_weight: null, underlying: 'S&P500',
      },
    ];
    apiMock.mfHoldings.mockResolvedValue(sameGroupHoldings);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    const groupLabel = within(dialog).getByText('S&P500');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Expand S&P500' }));
    const firstAsset = within(dialog).getByText('SCBS&P500-SSF');
    const secondAsset = within(dialog).getByText('SCBS&P500A');
    expect(groupLabel.compareDocumentPosition(firstAsset) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(firstAsset.compareDocumentPosition(secondAsset) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    expect(within(dialog).getByLabelText('SCBS&P500-SSF rebalance weight')).toHaveValue(50);
    expect(within(dialog).getByLabelText('SCBS&P500A rebalance weight')).toHaveValue(50);
  });

  it('leaves null weights blank when the group already has a stored weight', async () => {
    const partiallyConfigured = [
      { ...holdings[0], holding_id: 11, asset: 'SCBSEMI', rebalance_weight: 100, underlying: 'E' },
      { ...holdings[1], holding_id: 12, asset: 'SCBSEMI-A', rebalance_weight: null, underlying: 'E' },
      { ...holdings[1], holding_id: 13, asset: 'SCBSEMI-B', rebalance_weight: null, underlying: 'E' },
    ];
    apiMock.mfHoldings.mockResolvedValue(partiallyConfigured);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Expand E' }));
    expect(within(dialog).getByLabelText('SCBSEMI rebalance weight')).toHaveValue(100);
    expect(within(dialog).getByLabelText('SCBSEMI-A rebalance weight')).toHaveValue(null);
    expect(within(dialog).getByLabelText('SCBSEMI-B rebalance weight')).toHaveValue(null);
  });

  it('does not equal-split a group that has no stored weight at all', async () => {
    const unconfigured = [
      { ...holdings[0], holding_id: 21, asset: 'SCBSEMI', rebalance_weight: null, underlying: 'E' },
      { ...holdings[1], holding_id: 22, asset: 'SCBSEMI-A', rebalance_weight: null, underlying: 'E' },
    ];
    apiMock.mfHoldings.mockResolvedValue(unconfigured);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Expand E' }));
    expect(within(dialog).getByLabelText('SCBSEMI rebalance weight')).toHaveValue(50);
    expect(within(dialog).getByLabelText('SCBSEMI-A rebalance weight')).toHaveValue(50);
  });

  it('shows the neutral share per allocation group, not per holding', async () => {
    const twoGroups = [
      { ...holdings[0], holding_id: 31, asset: 'VOO-A', rebalance_weight: null, underlying: 'VOO' },
      { ...holdings[1], holding_id: 32, asset: 'VOO-B', rebalance_weight: null, underlying: 'VOO' },
      { ...holdings[0], holding_id: 33, asset: 'QQQ', rebalance_weight: null, underlying: 'QQQ' },
    ];
    apiMock.mfHoldings.mockResolvedValue(twoGroups);

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    expect(within(dialog).getAllByText('50.0% share')).toHaveLength(2);
  });

  it('renders the running target sum in weight mode', async () => {
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});
    apiMock.mfUpdateSettings.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Weight (%)' }));
    expect(within(dialog).getByText(/sum 0 \/ 100/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('VOO target weight'), { target: { value: '70' } });
    expect(within(dialog).getByText(/sum 70 \/ 100/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/partial targets/i)).toBeNull();
  });

  it('keeps the sum helper visible in neutral mode with the partial-target note', async () => {
    apiMock.mfHoldings.mockResolvedValue(holdings);

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    expect(within(dialog).getByText(/sum 0 \/ 100/)).toBeInTheDocument();
    expect(within(dialog).getByText(/partial targets are saved/i)).toBeInTheDocument();
  });

  it('does not render a Neutral/Weight toggle in the page header', async () => {
    renderScreen();
    await screen.findByRole('button', { name: 'Edit portfolio' });

    expect(screen.queryByRole('group', { name: 'Allocation mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Neutral' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Weight (%)' })).toBeNull();
  });
});

describe('PortfolioMutualFund group collapse', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.getPortfolio.mockResolvedValue(portfolio);
    apiMock.mfSettings.mockResolvedValue(settings);
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.mfOrders.mockResolvedValue([]);
    apiMock.mfHistory.mockResolvedValue([]);
  });

  it('collapses one group without touching the other group or the header meta', async () => {
    renderScreen();
    const toggle = await screen.findByRole('button', { name: 'Collapse VOO' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('group-split-VOO')).toBeInTheDocument();
    expect(screen.getByText('AAA')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Expand VOO' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('group-split-VOO')).toBeNull();
    expect(screen.queryByText('AAA')).toBeNull();
    expect(screen.getAllByText('50.0% target share')).toHaveLength(2);

    expect(screen.getByTestId('group-split-QQQ')).toBeInTheDocument();
    expect(screen.getByText('BBB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse QQQ' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('restores the holdings when the group is expanded again', async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse QQQ' }));
    expect(screen.queryByText('BBB')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand QQQ' }));

    expect(screen.getByTestId('group-split-QQQ')).toBeInTheDocument();
    expect(screen.getByText('BBB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse QQQ' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('MFEditPortfolioModal group collapse', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.getPortfolio.mockResolvedValue(portfolio);
    apiMock.mfSettings.mockResolvedValue({
      ...settings, allocation_mode: 'weight', target_ratio: { VOO: 60, QQQ: 40 },
    });
    apiMock.mfHoldings.mockResolvedValue(holdings);
    apiMock.mfOrders.mockResolvedValue([]);
    apiMock.mfHistory.mockResolvedValue([]);
  });

  it("starts every allocation group collapsed and reveals its weights on expand", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    expect(within(dialog).getByLabelText('VOO target weight')).toHaveValue(60);
    expect(within(dialog).getByText(/sum 100 \/ 100/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('AAA rebalance weight')).toBeNull();
    expect(within(dialog).queryByLabelText('BBB rebalance weight')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Expand VOO' }))
      .toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Expand VOO' }));

    expect(within(dialog).getByLabelText('AAA rebalance weight')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('BBB rebalance weight')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Collapse VOO' }));

    expect(within(dialog).queryByLabelText('AAA rebalance weight')).toBeNull();
    expect(within(dialog).getByLabelText('VOO target weight')).toHaveValue(60);
    expect(within(dialog).getByText(/sum 100 \/ 100/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Expand VOO' }))
      .toHaveAttribute('aria-expanded', 'false');
  });

  it("saves prefilled weights for every holding without expanding a group", async () => {
    apiMock.updatePortfolio.mockResolvedValue({});
    apiMock.mfUpdateHolding.mockResolvedValue({});
    apiMock.mfUpdateSettings.mockResolvedValue({});

    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit portfolio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit managed fund' });

    expect(within(dialog).queryByLabelText('AAA rebalance weight')).toBeNull();
    expect(within(dialog).queryByLabelText('BBB rebalance weight')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(apiMock.mfUpdateHolding).toHaveBeenCalledWith(
      7, 1, { rebalance_weight: 100 },
    ));
    expect(apiMock.mfUpdateHolding).toHaveBeenCalledWith(7, 2, { rebalance_weight: 100 });
    expect(apiMock.mfUpdateHolding).toHaveBeenCalledTimes(2);
  });
});
