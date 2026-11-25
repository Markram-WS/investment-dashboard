import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllAssets from '../pages/AllAssets';
import { NotificationProvider } from '../contexts/NotificationProvider';
import type { AssetProduct, AssetSymbol } from '../types';

const apiMock = vi.hoisted(() => ({
  getAssetGroups: vi.fn(),
  getProducts: vi.fn(),
  getSymbols: vi.fn(),
}));

vi.mock('../lib/api', () => ({ api: apiMock }));

const groups = [{ id: 1, name: 'Ungrouped', is_default: true, created_at: '' }];

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
      <DndProvider backend={HTML5Backend}>
        <NotificationProvider>
          <AllAssets />
        </NotificationProvider>
      </DndProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockReset());
  apiMock.getAssetGroups.mockResolvedValue(groups);
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

  it('shows the identity contract values and the span when set', async () => {
    renderRegistry();

    fireEvent.click(await screen.findByRole('button', { name: 'Expand S50' }));

    expect(await screen.findByText('mult · 1000 · 10%')).toBeInTheDocument();
    expect(screen.getByText('mult · 500 · 5% · span 500')).toBeInTheDocument();
    expect(screen.queryByText(/\(default\)/)).not.toBeInTheDocument();
    expect(screen.getAllByText('S50H26').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S50M26').length).toBeGreaterThan(0);
  });
});
