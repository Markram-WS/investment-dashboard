import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddOrderModal } from './AddOrderModal';
import OrderDetailLadder from './components/OrderDetailLadder';
import OrderHistoryCard from './components/OrderHistoryCard';
import TradeHistoryTable from './components/TradeHistoryTable';
import { orderRowWrites } from './PortfolioGrid';
import { useAddOrder } from '../hooks/useAddOrder';
import type { AddOrderForm } from '../hooks/useAddOrder';
import type { OrderWrites, SpreadOrder } from '../types';
import { api } from '../lib/api';
import type { TradeHistoryRecord } from '../lib/api';

const form = (overrides: Partial<AddOrderForm> = {}): AddOrderForm => ({
  order_id: 'ORD-1',
  destination: 'mapped',
  asset_type: 'S50C26',
  side: 'LONG',
  qty: '1',
  entry_price: '10',
  tp_price: '',
  sl_price: '',
  group_id: null,
  order_status: 'FILLED',
  contract_type: 'option',
  direction: '',
  option_type: 'Call',
  expiry_date: '2026-12-30',
  strike_price: '1000',
  cost: '0',
  order_ref: '',
  fee: '',
  remark: '',
  ...overrides,
});

function ModalHarness({
  initial,
  mapped,
  dashboardOption,
  mappedPortfolio,
}: {
  initial: AddOrderForm;
  mapped?: { fields: string[]; keyGenerated: boolean };
  dashboardOption?: boolean;
  mappedPortfolio?: boolean;
}) {
  const [data, setData] = React.useState(initial);
  return (
    <AddOrderModal
      formData={data}
      showModal
      onClose={() => {}}
      onSave={async () => {}}
      onChange={(field, value) => setData((prev) => ({ ...prev, [field]: value }))}
      groups={[]}
      groupOrderCounts={{}}
      assetTypeOptions={[]}
      mapped={mapped}
      dashboardOption={dashboardOption}
      mappedPortfolio={mappedPortfolio}
    />
  );
}

const mappedFields = {
  fields: ['order_ref', 'asset_type', 'side', 'qty', 'entry_price', 'tp_price', 'fee', 'remark'],
  keyGenerated: false,
};

const writes: OrderWrites = {
  mapped: {
    insert: true,
    update: true,
    delete: true,
    fields: mappedFields.fields,
    key_generated: false,
  },
  dashboard_options: { insert: true, update: true, delete: true },
};

const dashboardOption: SpreadOrder = {
  order_id: 'SAME-1',
  order_source: 'dashboard',
  asset_type: 'DASH-OPT',
  underlying: '',
  side: 'LONG',
  qty: 1,
  entry_price: 10,
  current_price: 12,
  tp_price: null,
  sl_price: null,
  leverage: null,
  margin_rate: null,
  order_status: 'FILLED',
  executed_by: 'Manual',
  created_at: '2026-11-25T10:00:00Z',
  linked_order_id: null,
  group_id: null,
  group_name: null,
  contract_type: 'option',
  option_type: 'Call',
  expiry_date: '2026-12-30',
  strike_price: 1000,
  cost: 0,
};

const mappedFuture: SpreadOrder = {
  order_id: 'SAME-1',
  order_source: 'mapped',
  asset_type: 'BOT-FUT',
  underlying: '',
  side: 'SHORT',
  qty: 2,
  entry_price: 900,
  current_price: 880,
  tp_price: null,
  sl_price: null,
  leverage: null,
  margin_rate: null,
  order_status: 'FILLED',
  executed_by: 'Bot',
  created_at: '2026-11-25T09:00:00Z',
  linked_order_id: null,
  group_id: null,
  group_name: null,
  contract_type: 'future',
  cost: 0,
};

const trade = (overrides: Partial<TradeHistoryRecord>): TradeHistoryRecord => ({
  history_id: 42,
  history_source: 'dashboard',
  history_key: '42',
  portfolio_id: 8,
  portfolio_name: 'TFEX Bridge Test',
  type: 'Long',
  asset: 'S50C26',
  amount: 1,
  exit_price: 12,
  realized_pl: 20,
  executed_by: 'Manual',
  decision_note: null,
  entry_date: '2026-11-20',
  exit_date: '2026-11-25',
  flow: null,
  remark: null,
  ...overrides,
});

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Add order destination', () => {
  it('offers both stores and keeps option fields on the dashboard path only', () => {
    const { unmount } = render(
      <ModalHarness initial={form()} mapped={mappedFields} dashboardOption mappedPortfolio />,
    );

    expect(screen.getByRole('button', { name: 'Connected DB' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard option' })).toBeInTheDocument();
    // Connected DB keeps today's mapped field list and has no option fields.
    expect(screen.getByLabelText('Broker order no.')).toBeInTheDocument();
    expect(screen.getByLabelText('Fee')).toBeInTheDocument();
    expect(screen.queryByText('Option type')).not.toBeInTheDocument();
    expect(screen.queryByText('Expiry date')).not.toBeInTheDocument();
    expect(screen.queryByText('Strike price')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard option' }));

    expect(screen.getByText('Option type')).toBeInTheDocument();
    expect(screen.getByLabelText('Expiry date')).toBeInTheDocument();
    expect(screen.getByLabelText('Strike price')).toBeInTheDocument();
    expect(screen.queryByLabelText('Broker order no.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fee')).not.toBeInTheDocument();

    unmount();
  });

  it('keeps the dashboard option path when the connected database is unavailable', () => {
    render(<ModalHarness initial={form({ destination: 'dashboard' })} dashboardOption mappedPortfolio />);

    expect(screen.queryByRole('button', { name: 'Connected DB' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard option' })).toBeInTheDocument();
    expect(screen.getByText('Option type')).toBeInTheDocument();
    expect(screen.getByLabelText('Strike price')).toBeInTheDocument();
  });

  it('leaves the non-mapped portfolio form unchanged', () => {
    render(<ModalHarness initial={form({ destination: 'dashboard', contract_type: 'spot', side: 'BUY', option_type: '' })} />);

    expect(screen.queryByRole('group', { name: 'Order destination' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Future' })).toBeInTheDocument();
  });
});

describe('Store-scoped order capabilities', () => {
  it('uses the row source store, never the other store, on a mapped portfolio', () => {
    expect(orderRowWrites({ order_source: 'dashboard' }, writes, true)).toEqual({
      edit: true,
      close: true,
      remark: true,
    });
    expect(orderRowWrites({ order_source: 'mapped' }, writes, true)).toEqual({
      edit: true,
      close: true,
      remark: true,
    });

    const mappedOnly: OrderWrites = {
      mapped: writes.mapped,
      dashboard_options: { insert: true, update: false, delete: false },
    };
    expect(orderRowWrites({ order_source: 'dashboard' }, mappedOnly, true)).toEqual({
      edit: false,
      close: false,
      remark: false,
    });

    const localOnly: OrderWrites = {
      mapped: {
        ...writes.mapped!,
        update: false,
        delete: false,
      },
      dashboard_options: { insert: true, update: true, delete: true },
    };
    expect(orderRowWrites({ order_source: 'mapped' }, localOnly, true)).toEqual({
      edit: false,
      close: false,
      remark: false,
    });
    // No source means no store to target.
    expect(orderRowWrites({}, localOnly, true)).toEqual({
      edit: false,
      close: false,
      remark: false,
    });
    // Non-mapped portfolios keep today's behaviour.
    expect(orderRowWrites({}, undefined, false)).toEqual({
      edit: true,
      close: true,
      remark: true,
    });
  });
});

describe('Active ladder sources', () => {
  const renderLadder = (props: Partial<React.ComponentProps<typeof OrderDetailLadder>> = {}) =>
    render(
      <OrderDetailLadder
        activeOrders={[dashboardOption, mappedFuture]}
        zones={[]}
        onShowZoneGroupModal={() => {}}
        onAddOrder={() => {}}
        onEditOrder={() => {}}
        onCloseOrder={() => {}}
        view="all"
        onViewChange={() => {}}
        mapped
        canAdd
        canEdit
        canClose
        {...props}
      />,
    );

  it('labels each row with its source and keys legs by source', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLadder();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Connected DB')).toBeInTheDocument();
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(false);
  });

  it('routes edit and close to the clicked row source', () => {
    const onEditOrder = vi.fn();
    const onCloseOrder = vi.fn();
    renderLadder({ onEditOrder, onCloseOrder });

    fireEvent.click(screen.getByRole('button', { name: /^Edit DASH-OPT Call/ }));
    expect(onEditOrder).toHaveBeenLastCalledWith(dashboardOption);

    fireEvent.click(screen.getByRole('button', { name: /^Edit BOT-FUT/ }));
    expect(onEditOrder).toHaveBeenLastCalledWith(mappedFuture);

    fireEvent.click(screen.getByRole('button', { name: /^Close DASH-OPT Call/ }));
    expect(onCloseOrder).toHaveBeenLastCalledWith(dashboardOption);

    fireEvent.click(screen.getByRole('button', { name: /^Close BOT-FUT/ }));
    expect(onCloseOrder).toHaveBeenLastCalledWith(mappedFuture);
  });

  it('hides an action when its own store forbids it', () => {
    renderLadder({ canEditOrder: (order) => order.order_source === 'dashboard' });

    expect(screen.getByRole('button', { name: /^Edit DASH-OPT Call/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit BOT-FUT/ })).not.toBeInTheDocument();
    // canEdit remains true globally: only the per-store resolver gates the row.
    expect(screen.getByRole('button', { name: /^Close BOT-FUT/ })).toBeInTheDocument();
  });

  it('prefixes the contract ticker with its underlying', () => {
    renderLadder({
      activeOrders: [{ ...dashboardOption, asset_type: 'S50H26', underlying: 'S50' }],
      view: 'option',
    });

    expect(screen.getByTitle('Underlying S50')).toHaveTextContent('S50 · S50H26');
  });

  it('renders the contract ticker alone when no underlying resolves', () => {
    renderLadder({
      activeOrders: [{ ...dashboardOption, asset_type: 'S50H26', underlying: '' }],
      view: 'option',
    });

    expect(screen.queryByTitle(/^Underlying /)).not.toBeInTheDocument();
    expect(screen.getByText('S50H26')).toBeInTheDocument();
  });
});

describe('History sources', () => {
  const history = [
    trade({ history_source: 'dashboard', history_key: '42', asset: 'DASH-OPT' }),
    trade({ history_source: 'mapped', history_key: '42', asset: 'BOT-FUT', executed_by: 'Bot' }),
  ];

  it('labels both sources with colliding legacy history ids', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<OrderHistoryCard tradeHistory={history} onViewAll={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Expand order history' }));

    expect(screen.getByText('DASH-OPT')).toBeInTheDocument();
    expect(screen.getByText('BOT-FUT')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Connected DB')).toBeInTheDocument();
  });

  it('renders the ledger with a source column and source-qualified keys', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <TradeHistoryTable
        tradeHistory={history}
        showHistory
        onToggleHistory={() => {}}
      />,
    );

    expect(screen.getAllByText('Source').length).toBe(2);
    expect(screen.getByText('DASH-OPT (1)')).toBeInTheDocument();
    expect(screen.getByText('BOT-FUT (1)')).toBeInTheDocument();
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Connected DB').length).toBeGreaterThan(0);
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(false);
  });
});

describe('API transport', () => {
  const okResponse = () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '{}',
  });

  it('passes the row source on every mapped single-order call', async () => {
    const mockFetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', mockFetch);

    await api.getOrder('SAME-1', 8, 'dashboard');
    await api.updateOrder('SAME-1', {}, 8, 'mapped');
    await api.cancelOrder('SAME-1', 8, 'mapped');
    await api.closeOrder('SAME-1', {}, 8, 'dashboard');

    const urls = mockFetch.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      '/api/v1/orders/SAME-1?portfolio_id=8&order_source=dashboard',
      '/api/v1/orders/SAME-1?portfolio_id=8&order_source=mapped',
      '/api/v1/orders/SAME-1/status?portfolio_id=8&order_source=mapped',
      '/api/v1/orders/SAME-1/close?portfolio_id=8&order_source=dashboard',
    ]);
  });

  it('omits the source for non-mapped callers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', mockFetch);

    await api.updateOrder('ORD-1', {}, 3);

    expect(String(mockFetch.mock.calls[0][0])).toBe('/api/v1/orders/ORD-1?portfolio_id=3');
  });

  it('posts contract_type "option" for a dashboard destination', async () => {
    const mockFetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAddOrder());
    act(() => result.current.openModal({ asset_type: 'S50C26', side: 'LONG', option_type: 'Call' }));
    await act(async () => {
      await result.current.handleCreateOrder(8, mappedFields, 'dashboard');
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.contract_type).toBe('option');
    expect(body.portfolio_id).toBe(8);
    expect(String(mockFetch.mock.calls[0][0])).toBe('/api/v1/orders');
  });
});
