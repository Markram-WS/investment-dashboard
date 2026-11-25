import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllAssets from '../pages/AllAssets';
import { NotificationProvider } from '../contexts/NotificationProvider';
import type { AssetProduct, AssetSymbol } from '../types';

const apiMock = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getSymbols: vi.fn(),
  getBrokers: vi.fn(),
  updateSymbolQuote: vi.fn(),
  updateSymbolPrice: vi.fn(),
}));

vi.mock('../lib/api', () => ({ api: apiMock }));

const piFuture: AssetProduct = {
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

const piStock: AssetProduct = {
  product_id: 5,
  ticker: 'S50',
  broker_id: 1,
  broker_code: 'PI',
  asset_type: 'stock',
  multiplier: 1,
  margin_rate: 0,
  margin_mode: 'notional',
  source: 'yfinance',
  group_id: null,
  name: null,
  symbol_count: 1,
};

const piPttStock: AssetProduct = {
  product_id: 6,
  ticker: 'PTT',
  broker_id: 1,
  broker_code: 'PI',
  asset_type: 'stock',
  multiplier: 1,
  margin_rate: 0,
  margin_mode: 'notional',
  source: 'yfinance',
  group_id: null,
  name: null,
  symbol_count: 1,
};

const dfStock: AssetProduct = {
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

const unassignedCrypto: AssetProduct = {
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

const aaaFuture: AssetProduct = {
  product_id: 7,
  ticker: 'AAA',
  broker_id: 1,
  broker_code: 'PI',
  asset_type: 'future',
  multiplier: 1,
  margin_rate: 0,
  margin_mode: 'notional',
  source: 'tfex',
  group_id: null,
  name: null,
  symbol_count: 1,
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
  price: 37.2,
  change_24h: -0.3,
};

const stockSymbol: AssetSymbol = {
  ...inheritedSymbol,
  symbol_id: 21,
  product_id: 5,
  price_symbol: 'S50S26',
  sync_symbol: 'S50S26',
  contract_kind: 'stock',
  price: 12.5,
  change_24h: 0.4,
};

const pttSymbol: AssetSymbol = {
  ...inheritedSymbol,
  symbol_id: 22,
  product_id: 6,
  price_symbol: 'PTT',
  sync_symbol: 'PTT.BK',
  contract_kind: 'stock',
  price: 35,
  change_24h: 0.8,
};

const aaaSymbol: AssetSymbol = {
  ...inheritedSymbol,
  symbol_id: 41,
  product_id: 7,
  price_symbol: 'AAAH26',
  sync_symbol: 'AAAH26',
};

const nullableSymbol: AssetSymbol = {
  ...inheritedSymbol,
  symbol_id: 31,
  product_id: 4,
  price_symbol: null,
  sync_symbol: 'XAUUSD',
};

const symbolsByProduct: Record<number, AssetSymbol[]> = {
  1: [inheritedSymbol, overriddenSymbol],
  4: [nullableSymbol],
  5: [stockSymbol],
  6: [pttSymbol],
  7: [aaaSymbol],
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
  apiMock.getProducts.mockResolvedValue([piFuture]);
  apiMock.getSymbols.mockImplementation(({ product_id }: { product_id?: number }) =>
    Promise.resolve(symbolsByProduct[product_id ?? -1] ?? []));
  apiMock.getBrokers.mockResolvedValue([{
    id: 1,
    code: 'PI',
    name: 'Phillip',
    default_margin_rate: 0.1,
    currency: 'THB',
  }]);
  apiMock.updateSymbolQuote.mockResolvedValue(inheritedSymbol);
  apiMock.updateSymbolPrice.mockResolvedValue({ ...inheritedSymbol, price: 5 });
});

describe('All assets registry head', () => {
  it('renders the four labeled heads plus an unlabeled action column and a trailing spacer', async () => {
    renderRegistry();

    await screen.findByText('1 product · 2 symbols');
    const heads = screen.getAllByRole('columnheader');

    expect(heads.map(head => head.textContent?.trim())).toEqual([
      'Product · type / symbol', 'Sync symbol', 'Price', 'Change', 'Actions',
    ]);
    expect(heads[0]).toHaveAttribute('title', 'Product: underlying and type, then its symbols');
    expect(heads[0]).toHaveClass('at-assets-name-col');
    expect(screen.queryByRole('columnheader', { name: 'Contracts' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('thead th')).toHaveLength(6);
  });

  it('uses fixed tracks and leaves only the trailing spacer flexible', async () => {
    renderRegistry();

    await screen.findByText('1 product · 2 symbols');
    const heads = screen.getAllByRole('columnheader');

    expect(heads.slice(1).map(head => head.style.width)).toEqual(['140px', '112px', '92px', '72px']);
    expect(screen.getByRole('table')).toHaveStyle({ tableLayout: 'fixed', minWidth: '656px' });
    const allHeads = document.querySelectorAll('thead th');
    const spacer = allHeads[4] as HTMLTableCellElement;
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
    expect(spacer.style.width).toBe('');
    expect(allHeads[5].textContent?.trim()).toBe('Actions');
  });
});

describe('All assets two-level rows', () => {
  it('orders products by underlying then type, and symbols by price symbol', async () => {
    apiMock.getProducts.mockResolvedValue([piFuture, piStock, piPttStock, aaaFuture]);
    apiMock.getSymbols.mockImplementation(({ product_id }: { product_id?: number }) =>
      Promise.resolve(product_id === 1 ? [overriddenSymbol, inheritedSymbol] : symbolsByProduct[product_id ?? -1] ?? []));
    renderRegistry();

    await screen.findAllByText('S50M26');

    const rows = Array.from(document.querySelectorAll('tbody tr[data-level]'));
    expect(rows.map(row => row.getAttribute('data-level'))).toEqual([
      'product', 'symbol',
      'product', 'symbol',
      'product', 'symbol',
      'product', 'symbol', 'symbol',
    ]);

    const productNames = rows
      .filter(row => row.getAttribute('data-level') === 'product')
      .map(row => row.querySelector('td')?.textContent?.trim());
    expect(productNames).toEqual(['AAAfuture', 'PTTstock', 'S50stock', 'S50future']);

    const symbolNames = rows
      .filter(row => row.getAttribute('data-level') === 'symbol')
      .map(row => row.querySelector('td')?.textContent?.replace('has no price', '').trim());
    expect(symbolNames).toEqual(['AAAH26', 'PTT', 'S50S26', 'S50H26', 'S50M26']);
  });

  it('orders mutual_fund after crypto and exposes its tab', async () => {
    const optionProduct = { ...piFuture, product_id: 50, asset_type: 'option', symbol_count: 0 };
    const cryptoProduct = { ...piFuture, product_id: 51, asset_type: 'crypto', symbol_count: 0 };
    const mutualFundProduct = { ...piFuture, product_id: 52, asset_type: 'mutual_fund', symbol_count: 0 };
    apiMock.getProducts.mockResolvedValue([
      mutualFundProduct, cryptoProduct, optionProduct, piFuture, piStock,
    ]);
    renderRegistry();

    await waitFor(() => {
      expect(document.querySelectorAll('tr[data-level="product"]')).toHaveLength(5);
    });
    const productNames = Array.from(document.querySelectorAll('tr[data-level="product"]'))
      .map(row => row.querySelector('td')?.textContent?.trim());
    expect(productNames).toEqual([
      'S50stock', 'S50future', 'S50option', 'S50crypto', 'S50mutual_fund',
    ]);

    expect(Array.from(document.querySelectorAll('.at-tab')).map(tab => tab.textContent))
      .toEqual(['All', 'Stock', 'Future', 'Option', 'Crypto', 'Mutual Fund']);
    const mutualTab = screen.getByRole('button', { name: 'Mutual Fund' });
    fireEvent.click(mutualTab);
    await waitFor(() => {
      expect(apiMock.getProducts).toHaveBeenLastCalledWith({ asset_type: 'mutual_fund' });
    });
  });

  it('puts the identity meta in the Price cell and leaves the identity cells blank', async () => {
    renderRegistry();

    await screen.findAllByText('S50M26');
    const productRow = document.querySelector('tr[data-level="product"]') as HTMLTableRowElement;
    const productCells = Array.from(productRow.children).map(cell => cell.textContent?.trim());

    expect(productCells).toEqual([
      'S50future', '', '1000 · 10% · notional · tfex', '', '', '',
    ]);

    const symbolRow = document.querySelector('tr[data-level="symbol"][data-symbol-id="11"]') as HTMLTableRowElement;
    const symbolCells = Array.from(symbolRow.children).map(cell => cell.textContent?.trim());

    expect(symbolCells).toEqual(['S50H26has no price', 'S50H26', '—', '—', '', '']);
    expect(productRow.children[2]).toHaveStyle({ fontSize: 'var(--fs-micro)', fontVariantNumeric: 'tabular-nums' });
  });

  it('shows has-no-price only for feed-backed products and explains manual silence in the title', async () => {
    renderRegistry();

    const priceCell = await screen.findByText('$37.20');
    expect(screen.getByText('has no price')).toBeInTheDocument();
    expect(screen.getByText('-0.3%')).toBeInTheDocument();
    expect(priceCell).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });

  it('keeps a manual no-quote symbol quiet and keeps Edit first in its action row', async () => {
    apiMock.getProducts.mockResolvedValue([nullUnderlyingProduct]);
    renderRegistry();

    await screen.findByText('XAUUSD');
    const row = document.querySelector('tr[data-level="symbol"][data-symbol-id="31"]') as HTMLTableRowElement;

    expect(within(row).queryByText('has no price')).not.toBeInTheDocument();
    expect(row.children[0]).toHaveAttribute('title', 'No quote — this product has no price feed.');
    expect(row.children[0].textContent?.trim()).toBe('—');

    const slots = row.querySelectorAll('td:nth-child(6) > div > span');
    expect(slots).toHaveLength(2);
    expect(slots[0].querySelector('button')).toHaveAttribute('aria-label', 'Edit symbol');
    expect(slots[1].querySelector('button')).toBeNull();
  });

  it('shows one short No symbols row for an empty product', async () => {
    apiMock.getProducts.mockResolvedValue([unassignedCrypto]);
    renderRegistry();

    const empty = await screen.findByText('No symbols');
    expect(empty.closest('tr')).toHaveAttribute('title', 'Orders cannot resolve a contract spec for this product.');
    expect(screen.queryByText(/Orders cannot resolve/)).not.toBeInTheDocument();
  });
});

describe('All assets actions', () => {
  it('adds a + New symbol pill and opens the modal on the first available product', async () => {
    renderRegistry();

    await screen.findByText('1 product · 2 symbols');
    const pills = Array.from(document.querySelectorAll('.at-znew'))
      .map(pill => pill.textContent?.trim());
    expect(pills).toEqual(['Sync from orders', '+ New product', '+ New symbol']);

    const toolbarPill = Array.from(document.querySelectorAll('.at-znew'))
      .find(pill => pill.textContent?.trim() === '+ New symbol') as HTMLButtonElement;
    fireEvent.click(toolbarPill);

    expect(await screen.findByRole('heading', { name: 'New symbol' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Underlying' })).toHaveTextContent('S50');
    expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Future');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create symbol' })).toBeEnabled());
  });

  it('opens the symbol modal from a product row with that product', async () => {
    apiMock.getProducts.mockResolvedValue([piFuture, piStock]);
    renderRegistry();

    await screen.findAllByText('S50S26');
    const productRow = document.querySelector('tr[data-level="product"][data-product-id="5"]') as HTMLTableRowElement;
    fireEvent.click(within(productRow).getByRole('button', { name: '+ New symbol' }));

    expect(await screen.findByRole('combobox', { name: 'Underlying' })).toHaveTextContent('S50');
    expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Stock');
    expect(await screen.findByText('S50 · PI · stock')).toBeInTheDocument();
  });

  it('keeps Edit first and the add/refresh action last in each action row', async () => {
    renderRegistry();

    await screen.findAllByRole('button', { name: 'Edit symbol' });
    const productRow = document.querySelector('tr[data-level="product"]') as HTMLTableRowElement;
    const symbolRow = document.querySelector('tr[data-level="symbol"]') as HTMLTableRowElement;
    const productButtons = Array.from(productRow.children[5]?.querySelectorAll('button') ?? []);
    const symbolButtons = Array.from(symbolRow.children[5]?.querySelectorAll('button') ?? []);

    expect(productButtons.map(button => button.getAttribute('aria-label'))).toEqual(['Edit product', '+ New symbol']);
    expect(symbolButtons.map(button => button.getAttribute('aria-label'))).toEqual(['Edit symbol', 'Refresh S50H26']);
    expect(productButtons[0]).toHaveAttribute('aria-label', 'Edit product');
    expect(symbolButtons[0]).toHaveAttribute('aria-label', 'Edit symbol');
  });

  it('saves an in-place price on a symbol row', async () => {
    renderRegistry();

    fireEvent.click(await screen.findByText('$37.20'));
    const input = screen.getByDisplayValue('37.2');
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(apiMock.updateSymbolQuote).toHaveBeenCalledWith(12, { price: 40 });
    });
  });
});

describe('All assets collapse levels', () => {
  it('collapses a broker without hiding the other broker', async () => {
    apiMock.getProducts.mockResolvedValue([piFuture, dfStock]);
    renderRegistry();

    fireEvent.click(await screen.findByRole('button', { name: 'Collapse PI' }));

    expect(screen.queryByRole('button', { name: 'Collapse S50 future' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse PTT stock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand PI' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses only one product’s symbol rows', async () => {
    apiMock.getProducts.mockResolvedValue([piFuture, piStock]);
    renderRegistry();

    await screen.findAllByText('S50S26');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse S50 future' }));

    expect(screen.queryAllByText('S50H26')).toHaveLength(0);
    expect(screen.queryAllByText('S50M26')).toHaveLength(0);
    expect(screen.getAllByText('S50S26').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Expand S50 future' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('All assets broker grouping and filtering', () => {
  it('renders broker sections by code with Unassigned last and counts in the summary', async () => {
    apiMock.getProducts.mockResolvedValue([unassignedCrypto, piFuture, dfStock]);
    renderRegistry();

    const df = await screen.findByText('DF · 1');
    const pi = screen.getByText('PI · 1');
    const unassigned = screen.getByText('Unassigned · 1');

    expect(Boolean(df.compareDocumentPosition(pi) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(pi.compareDocumentPosition(unassigned) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getByText('3 products · 2 symbols')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Unassigned' })).toBeInTheDocument();
  });

  it('filters products by type tab before grouping and updates the summary', async () => {
    renderRegistry();

    expect(await screen.findByText('1 product · 2 symbols')).toBeInTheDocument();

    apiMock.getProducts.mockResolvedValue([piStock]);
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));

    await waitFor(() => {
      expect(apiMock.getProducts).toHaveBeenLastCalledWith({ asset_type: 'stock' });
    });
    expect(await screen.findByText('1 product · 1 symbol')).toBeInTheDocument();
    expect((await screen.findAllByText('S50S26')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('S50M26')).toHaveLength(0);
  });

  it('renders the empty registry head and a no-products row', async () => {
    apiMock.getProducts.mockResolvedValue([]);
    renderRegistry();

    expect(await screen.findByText('No products')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.getByText('0 products · 0 symbols')).toBeInTheDocument();
  });

  it('labels a null underlying with an em dash and never renders null', async () => {
    apiMock.getProducts.mockResolvedValue([nullUnderlyingProduct]);
    renderRegistry();

    const toggle = await screen.findByRole('button', { name: 'Collapse — future' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    expect(screen.getByText('1 product · 1 symbol')).toBeInTheDocument();
  });
});
