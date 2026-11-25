import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllAssets from '../pages/AllAssets';
import { NotificationProvider } from '../contexts/NotificationProvider';
import type { AssetProduct, AssetSymbol } from '../types';

const apiMock = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getSymbols: vi.fn(),
}));

vi.mock('../lib/api', () => ({ api: apiMock }));

const product: AssetProduct = {
  product_id: 1,
  ticker: 'S50',
  broker_id: 1,
  broker_code: 'PI',
  asset_type: 'future',
  multiplier: 1000,
  margin_rate: 0.1,
  margin_mode: 'notional',
  source: 'tfex',
  group_id: null,
  name: null,
  symbol_count: 2,
};

const dfProduct: AssetProduct = {
  product_id: 2,
  ticker: 'PTT',
  broker_id: 2,
  broker_code: 'DF',
  asset_type: 'stock',
  multiplier: 1,
  margin_rate: 0,
  margin_mode: 'notional',
  source: 'yfinance',
  group_id: null,
  name: null,
  symbol_count: 0,
};

const unassignedProduct: AssetProduct = {
  product_id: 3,
  ticker: 'XAUUSD',
  broker_id: null,
  broker_code: null,
  asset_type: 'crypto',
  multiplier: 1,
  margin_rate: 0,
  margin_mode: 'notional',
  source: 'yfinance',
  group_id: null,
  name: null,
  symbol_count: 0,
};

const nullUnderlyingProduct: AssetProduct = {
  product_id: 4,
  ticker: null,
  broker_id: null,
  broker_code: null,
  asset_type: 'future',
  multiplier: 1,
  margin_rate: 0,
  margin_mode: 'notional',
  source: 'manual',
  group_id: null,
  name: null,
  symbol_count: 1,
};

const inheritedSymbol: AssetSymbol = {
  symbol_id: 11,
  product_id: 1,
  price_symbol: 'S50H26',
  sync_symbol: 'S50H26',
  contract_kind: 'future',
  option_type: null,
  expiry_date: null,
  strike_price: null,
  multiplier_override: null,
  margin_rate_override: null,
  margin_per_contract: null,
  multiplier_effective: 1000,
  margin_rate_effective: 0.1,
  multiplier_inherited: true,
  margin_rate_inherited: true,
  price: null,
  change_24h: null,
  updated_at: null,
};

const overriddenSymbol: AssetSymbol = {
  ...inheritedSymbol,
  symbol_id: 12,
  price_symbol: 'S50M26',
  sync_symbol: 'S50M26',
  multiplier_override: 500,
  margin_rate_override: 0.05,
  margin_per_contract: 500,
  multiplier_effective: 500,
  margin_rate_effective: 0.05,
  multiplier_inherited: false,
  margin_rate_inherited: false,
};

const renderRegistry = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationProvider>
        <AllAssets />
      </NotificationProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockReset());
  apiMock.getProducts.mockResolvedValue([product]);
  apiMock.getSymbols.mockResolvedValue([inheritedSymbol, overriddenSymbol]);
});

describe('All assets naming', () => {
  it('heads the product identity Underlying and marks its spec as defaults', async () => {
    renderRegistry();

    const head = await screen.findByRole('columnheader', { name: 'Underlying' });
    expect(head).toHaveAttribute('title', 'Underlying: the product that owns these contracts');
    expect(screen.getByRole('columnheader', { name: 'Multiplier' }))
      .toHaveAttribute('title', 'Default multiplier — inherited by every contract unless the contract overrides it');
    expect(screen.getByRole('columnheader', { name: 'Margin' }))
      .toHaveAttribute('title', expect.stringContaining('Default margin rate'));
  });

  it('drops the Broker column and counts symbols', async () => {
    renderRegistry();

    expect(await screen.findByRole('columnheader', { name: 'Contracts' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Symbols' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Broker' })).not.toBeInTheDocument();
    expect(await screen.findByText('1 product · 2 symbols')).toBeInTheDocument();
  });

  it('shows the identity contract values and the span when set', async () => {
    renderRegistry();

    fireEvent.click(await screen.findByRole('button', { name: 'Expand S50' }));

    expect(await screen.findByText('mult · 1000 · 10%')).toBeInTheDocument();
    expect(screen.getByText('mult · 500 · 5% · span 500')).toBeInTheDocument();
    expect(screen.queryByText(/\(default\)/)).not.toBeInTheDocument();
    expect(screen.getAllByText('S50H26').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S50M26').length).toBeGreaterThan(0);
  });

  it('names the toolbar and row actions for products and symbols', async () => {
    renderRegistry();

    expect(await screen.findByRole('button', { name: '+ New product' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync from orders' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add symbol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit identity' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Edit product' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ New symbol' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand S50' }));

    expect(await screen.findAllByRole('button', { name: 'Edit symbol' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Edit contract' })).not.toBeInTheDocument();
  });
});

describe('All assets broker sections', () => {
  it('renders one section per broker, ordered by code, with Unassigned last', async () => {
    apiMock.getProducts.mockResolvedValue([unassignedProduct, product, dfProduct]);
    renderRegistry();

    const df = await screen.findByText('DF · 1');
    const pi = screen.getByText('PI · 1');
    const unassigned = screen.getByText('Unassigned · 1');

    expect(Boolean(df.compareDocumentPosition(pi) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(pi.compareDocumentPosition(unassigned) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByRole('button', { name: 'Collapse DF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse PI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Unassigned' })).toBeInTheDocument();
    expect(screen.getByText('3 products · 2 symbols')).toBeInTheDocument();
  });

  it('renders one table per broker with its own head, ordered, collapsed independently', async () => {
    apiMock.getProducts.mockResolvedValue([unassignedProduct, product, dfProduct]);
    renderRegistry();

    await screen.findByText('DF · 1');

    const tables = Array.from(document.querySelectorAll('table'));
    expect(tables).toHaveLength(3);
    for (const table of tables) {
      expect(table.querySelector('thead')).not.toBeNull();
      expect(table.querySelector('tbody')).not.toBeNull();
    }

    const brokerHeadings = screen.getAllByRole('button', { name: /^(Collapse|Expand) (DF|PI|Unassigned)$/ })
      .map(button => button.getAttribute('aria-label'));
    expect(brokerHeadings).toEqual(['Collapse DF', 'Collapse PI', 'Collapse Unassigned']);

    for (const table of tables) {
      expect(table.querySelector('tbody')?.textContent ?? '')
        .not.toMatch(/(DF|PI|Unassigned) · \d/);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Collapse DF' }));

    expect(screen.queryByText('PTT')).not.toBeInTheDocument();
    expect(screen.getByText('S50')).toBeInTheDocument();
    expect(document.querySelectorAll('table')).toHaveLength(3);
  });

  it('hides the Unassigned section when every identity has a broker', async () => {
    renderRegistry();

    expect(await screen.findByText('PI · 1')).toBeInTheDocument();
    expect(screen.queryByText(/^Unassigned · /)).not.toBeInTheDocument();
  });

  it('labels a null-underlying row without rendering null', async () => {
    apiMock.getProducts.mockResolvedValue([nullUnderlyingProduct]);
    renderRegistry();

    const toggle = await screen.findByRole('button', { name: 'Expand —' });

    expect(toggle).toHaveAttribute('aria-label', 'Expand —');
    expect(screen.getByRole('button', { name: '+ New symbol' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /null/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 product · 1 symbol')).toBeInTheDocument();
  });

  it('counts products and symbols from the filtered query result', async () => {
    renderRegistry();

    expect(await screen.findByText('1 product · 2 symbols')).toBeInTheDocument();

    apiMock.getProducts.mockResolvedValue([dfProduct]);
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));

    await waitFor(() => {
      expect(apiMock.getProducts).toHaveBeenLastCalledWith({ asset_type: 'stock' });
    });
    expect(await screen.findByText('1 product · 0 symbols')).toBeInTheDocument();
  });

  it('collapses a broker section without hiding the other sections', async () => {
    apiMock.getProducts.mockResolvedValue([product, dfProduct]);
    renderRegistry();

    fireEvent.click(await screen.findByRole('button', { name: 'Collapse DF' }));

    expect(screen.queryByText('PTT')).not.toBeInTheDocument();
    expect(screen.getByText('S50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand DF' })).toHaveAttribute('aria-expanded', 'false');
  });
});
