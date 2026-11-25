import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SyncFromOrdersModal from './SyncFromOrdersModal';
import type { AssetProduct, AssetSyncProposal } from '../../types';
import type { BrokerRecord } from '../../lib/api';

const apiMock = vi.hoisted(() => ({
  getAssetProposal: vi.fn(),
  applyAssetProposal: vi.fn(),
  getBrokers: vi.fn(),
  getProducts: vi.fn(),
}));

vi.mock('../../lib/api', () => ({ api: apiMock }));

const NO_TYPE_HELPER = "No type means the price symbol gets no type of its own: it joins the identity with this row's underlying (or none) and broker, and inherits that identity's multiplier, margin and price source — a brand-new default identity is multiplier 1, margin 0 and no feed.";
const IDENTITY_SENTENCE = 'The price symbol joins the identity with the underlying below and the broker above.';
const BROKERLESS_HINT = 'No broker on the portfolio — pick one here to attach this symbol to a broker-scoped product.';

const proposal: AssetSyncProposal = {
  items: [
    {
      symbol: 'S50H26',
      broker_id: 1,
      broker_code: 'PI',
      broker_required: false,
      resolved: false,
      products: [],
      order_asset_types: ['future'],
      create: { symbol: 'S50H26' },
    },
  ],
};

/** The same pair plus a brokerless pair, so flagged and unflagged rows share one render. */
const proposalWithBrokerless: AssetSyncProposal = {
  items: [
    ...proposal.items,
    {
      symbol: 'NOBROKER',
      broker_id: null,
      broker_code: null,
      broker_required: true,
      resolved: false,
      products: [],
      order_asset_types: ['future'],
      create: { symbol: 'NOBROKER' },
    },
  ],
};

const brokers: BrokerRecord[] = [
  { id: 1, code: 'PI', name: 'Pi Securities', default_margin_rate: 0, currency: 'THB' },
  { id: 2, code: 'KS', name: 'Kasikorn Securities', default_margin_rate: 0, currency: 'THB' },
];

const brokerOneProduct: AssetProduct = {
  product_id: 11,
  ticker: 'S50',
  broker_id: 1,
  broker_code: 'PI',
  asset_type: 'future',
  multiplier: 1000,
  margin_rate: 0.1,
  margin_mode: 'notional',
  source: 'tfex',
  group_id: null,
  name: 'S50 future',
  symbol_count: 1,
};

const brokerTwoProduct: AssetProduct = {
  product_id: 22,
  ticker: 'PTT',
  broker_id: 2,
  broker_code: 'KS',
  asset_type: 'stock',
  multiplier: 1,
  margin_rate: 1,
  margin_mode: 'notional',
  source: 'yfinance',
  group_id: null,
  name: 'PTT stock',
  symbol_count: 2,
};

const unassignedProduct: AssetProduct = {
  product_id: 33,
  ticker: 'GOLD',
  broker_id: null,
  broker_code: null,
  asset_type: 'future',
  multiplier: 10,
  margin_rate: 0,
  margin_mode: 'span',
  source: 'manual',
  group_id: null,
  name: 'GOLD futures',
  symbol_count: 3,
};

const renderSync = (onApplied = vi.fn(), onClose = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SyncFromOrdersModal open onClose={onClose} onApplied={onApplied} />
    </QueryClientProvider>,
  );
};

const openCreate = async () => {
  const assign = await screen.findByRole('combobox', { name: 'Assign S50H26' });
  fireEvent.change(assign, { target: { value: 'create' } });
};

const fillRequired = (source: 'tfex' | 'manual') => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Asset type for S50H26' }), { target: { value: 'future' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Price source for S50H26' }), { target: { value: source } });
  if (source !== 'manual') {
    fireEvent.change(screen.getByLabelText('Provider symbol for S50H26'), { target: { value: ' S50H26 ' } });
  }
};

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockReset());
  apiMock.getAssetProposal.mockResolvedValue(proposal);
  apiMock.applyAssetProposal.mockResolvedValue({ created: 1, choices: 1 });
  apiMock.getBrokers.mockResolvedValue(brokers);
  apiMock.getProducts.mockResolvedValue([brokerOneProduct, brokerTwoProduct, unassignedProduct]);
});

describe('Sync from orders broker pick', () => {
  it('defaults the row broker to the proposal broker and keeps Unassigned selectable', async () => {
    apiMock.getAssetProposal.mockResolvedValue(proposalWithBrokerless);
    renderSync();

    expect(await screen.findByRole('combobox', { name: 'Broker for S50H26' })).toHaveValue('1');
    const brokerlessSelect = screen.getByRole('combobox', { name: 'Broker for NOBROKER' });
    expect(brokerlessSelect).toHaveValue('');
    expect(within(brokerlessSelect).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Unassigned', 'PI', 'KS']);
  });

  it('filters Assign-to options by the chosen broker and resets a pick the broker no longer offers', async () => {
    renderSync();
    const assign = await screen.findByRole('combobox', { name: 'Assign S50H26' });
    await screen.findByRole('option', { name: 'S50 · future · 1 symbol' });

    fireEvent.change(assign, { target: { value: 'product:11' } });
    expect(assign).toHaveValue('product:11');

    fireEvent.change(screen.getByRole('combobox', { name: 'Broker for S50H26' }), { target: { value: '2' } });

    expect(screen.queryByRole('option', { name: 'S50 · future · 1 symbol' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PTT · stock · 2 symbols' })).toBeInTheDocument();
    expect(assign).toHaveValue('');
    expect(within(assign).getByRole('option', { name: 'Create new — S50H26' })).toBeInTheDocument();
  });

  it('offers only Create new when the chosen broker has no product', async () => {
    apiMock.getProducts.mockResolvedValue([brokerOneProduct]);
    renderSync();
    expect(await screen.findByRole('option', { name: 'S50 · future · 1 symbol' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Broker for S50H26' }), { target: { value: '2' } });
    const assign = screen.getByRole('combobox', { name: 'Assign S50H26' });

    expect(within(assign).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Select…', 'Create new — S50H26']);
  });

  it('posts the broker picked for a product assignment', async () => {
    renderSync();
    const assign = await screen.findByRole('combobox', { name: 'Assign S50H26' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Broker for S50H26' }), { target: { value: '2' } });
    await screen.findByRole('option', { name: 'PTT · stock · 2 symbols' });
    fireEvent.change(assign, { target: { value: 'product:22' } });

    fireEvent.click(screen.getByRole('button', { name: 'Apply 1' }));

    await waitFor(() => {
      expect(apiMock.applyAssetProposal).toHaveBeenCalledWith([
        { symbol: 'S50H26', broker_id: 2, product_id: 22 },
      ]);
    });
  });

  it('replaces the broker-required block with a hint shown only on flagged rows', async () => {
    apiMock.getAssetProposal.mockResolvedValue(proposalWithBrokerless);
    renderSync();

    await screen.findByRole('combobox', { name: 'Broker for NOBROKER' });
    expect(screen.getAllByText(BROKERLESS_HINT)).toHaveLength(1);
    expect(screen.queryByText(/Assign a broker in Edit portfolio before adding orders/)).not.toBeInTheDocument();
  });

  it('assigns a broker to a brokerless pair and sends it on Apply', async () => {
    apiMock.getAssetProposal.mockResolvedValue(proposalWithBrokerless);
    renderSync();

    fireEvent.change(await screen.findByRole('combobox', { name: 'Broker for NOBROKER' }), { target: { value: '1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Assign NOBROKER' }), { target: { value: 'create' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Price source for NOBROKER' }), { target: { value: 'manual' } });

    const apply = screen.getByRole('button', { name: 'Apply 1' });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    await waitFor(() => {
      expect(apiMock.applyAssetProposal).toHaveBeenCalledWith([
        {
          symbol: 'NOBROKER',
          broker_id: 1,
          create_product: true,
          create_source: 'manual',
          create_sync_symbol: '',
          create_underlying: '',
        },
      ]);
    });
  });
});

describe('Sync from orders create panel', () => {
  it('labels the create option with the proposal create symbol and asks for the underlying', async () => {
    renderSync();
    await screen.findByRole('combobox', { name: 'Assign S50H26' });

    expect(screen.getByRole('option', { name: 'Create new — S50H26' })).toBeInTheDocument();

    await openCreate();

    expect(screen.getByLabelText('Underlying for S50H26')).toHaveValue('');
    expect(screen.getByPlaceholderText('e.g. S50, or leave blank')).toBeInTheDocument();
    expect(screen.getByText(IDENTITY_SENTENCE)).toBeInTheDocument();
    expect(screen.getByText('Empty = use the identity with no underlying; the row\'s broker still applies.')).toBeInTheDocument();
    expect(screen.getByText(/Pick the underlying if the contract has one/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No type — default identity' })).toBeInTheDocument();
  });

  it('shows the default-identity helper only while no type is selected', async () => {
    renderSync();
    await openCreate();

    const typeSelect = screen.getByRole('combobox', { name: 'Asset type for S50H26' });
    expect(screen.getByText(NO_TYPE_HELPER)).toBeInTheDocument();

    fireEvent.change(typeSelect, { target: { value: 'future' } });
    expect(screen.queryByText(NO_TYPE_HELPER)).not.toBeInTheDocument();

    fireEvent.change(typeSelect, { target: { value: '' } });
    expect(screen.getByText(NO_TYPE_HELPER)).toBeInTheDocument();
  });

  it('keeps Apply enabled with a blank underlying and sends it as an empty string', async () => {
    const onApplied = vi.fn();
    renderSync(onApplied);
    await openCreate();
    fillRequired('tfex');

    const apply = screen.getByRole('button', { name: 'Apply 1' });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    await waitFor(() => {
      expect(apiMock.applyAssetProposal).toHaveBeenCalledWith([
        {
          symbol: 'S50H26',
          broker_id: 1,
          create_product: true,
          create_source: 'tfex',
          create_asset_type: 'future',
          create_sync_symbol: 'S50H26',
          create_underlying: '',
        },
      ]);
    });
    expect(onApplied).toHaveBeenCalled();
  });

  it('sends the trimmed underlying when the contract has one', async () => {
    renderSync();
    await openCreate();
    fillRequired('manual');
    fireEvent.change(screen.getByLabelText('Underlying for S50H26'), { target: { value: ' S50 ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Apply 1' }));

    await waitFor(() => {
      expect(apiMock.applyAssetProposal).toHaveBeenCalledWith([
        expect.objectContaining({
          create_underlying: 'S50',
          create_sync_symbol: '',
          create_source: 'manual',
          create_asset_type: 'future',
        }),
      ]);
    });
  });

  it('accepts no type with a manual source and omits create_asset_type', async () => {
    const onApplied = vi.fn();
    renderSync(onApplied);
    await openCreate();
    fireEvent.change(screen.getByRole('combobox', { name: 'Price source for S50H26' }), { target: { value: 'manual' } });

    const apply = screen.getByRole('button', { name: 'Apply 1' });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    await waitFor(() => {
      expect(apiMock.applyAssetProposal).toHaveBeenCalledWith([
        {
          symbol: 'S50H26',
          broker_id: 1,
          create_product: true,
          create_source: 'manual',
          create_sync_symbol: '',
          create_underlying: '',
        },
      ]);
    });
    const [choices] = apiMock.applyAssetProposal.mock.calls[0];
    expect(choices[0]).not.toHaveProperty('create_asset_type');
    expect(onApplied).toHaveBeenCalled();
  });
});
