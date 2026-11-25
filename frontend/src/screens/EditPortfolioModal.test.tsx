import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditPortfolioModal from './EditPortfolioModal';
import type { AssetProduct } from '../types';

const apiMock = vi.hoisted(() => ({
  getBrokers: vi.fn(),
  getProducts: vi.fn(),
  updatePortfolio: vi.fn(),
  createTransaction: vi.fn(),
  deletePortfolio: vi.fn(),
}));

vi.mock('../lib/api', () => ({ api: apiMock }));

const piBroker = {
  id: 1,
  code: 'PI',
  name: 'Phillip',
  default_margin_rate: 0.1,
  currency: 'THB',
  created_at: null,
};

const products: AssetProduct[] = [
  {
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
  },
  {
    product_id: 2,
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
    symbol_count: 0,
  },
  {
    product_id: 3,
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
  },
];

const renderModal = (overrides: Partial<React.ComponentProps<typeof EditPortfolioModal>> = {}) => render(
  <EditPortfolioModal
    portfolioId={1}
    portfolioName="Growth"
    marginLocked={0}
    cashBufferLimit={0}
    brokerId={1}
    productTicker="S50"
    productTickers={['S50']}
    productType={null}
    products={products}
    xAmount={0}
    initialCapital={0}
    rawAvailableCash={10000}
    cumulativePl={0}
    tags={null}
    showModal
    onClose={vi.fn()}
    onSaved={vi.fn()}
    onDepositWithdraw={vi.fn()}
    activeOrderCount={0}
    onDeleted={vi.fn()}
    {...overrides}
  />,
);

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockReset());
  apiMock.getBrokers.mockResolvedValue([piBroker]);
  apiMock.getProducts.mockResolvedValue(products);
  apiMock.updatePortfolio.mockResolvedValue({});
});

describe('Edit portfolio identity', () => {
  it('renames Underlying, adds the Type listbox and puts — No type — first', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 220, height: 26, top: 100, left: 100, right: 320, bottom: 126, x: 100, y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    renderModal();
    expect(screen.getByText('Underlying')).toBeInTheDocument();
    expect(screen.getByText('Underlyings this portfolio trades')).toBeInTheDocument();
    expect(screen.getByText("Maps the portfolio's multiplier and margin display to this underlying · broker · type."))
      .toBeInTheDocument();

    const type = screen.getByRole('combobox', { name: 'Type' });
    fireEvent.click(type);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')[0]).toHaveTextContent('— No type —');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent))
      .toEqual(['— No type —', 'Stock', 'Future', 'Option', 'Crypto']);
    rect.mockRestore();
  });

  it('posts product_type future when Future is selected', async () => {
    renderModal();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'f' });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Future');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(apiMock.updatePortfolio).toHaveBeenCalledWith(1, expect.objectContaining({
        product_type: 'future',
      }));
    });
  });

  it('posts product_type null when no type is selected', async () => {
    renderModal();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(apiMock.updatePortfolio).toHaveBeenCalledWith(1, expect.objectContaining({
        product_type: null,
      }));
    });
  });

  it('shows the resolved identity for a matching product', async () => {
    renderModal({ productType: 'future' });

    expect(await screen.findByText('S50 · PI · future — multiplier 1000 · margin 10% · notional'))
      .toBeInTheDocument();
  });

  it('shows the fallback identity sentence when no product matches', async () => {
    renderModal({ productType: 'crypto' });

    expect(await screen.findByText('No matching product — multiplier 1 · margin 0% will be used.'))
      .toBeInTheDocument();
  });

  it('disables the Type listbox for a read-only portfolio', () => {
    renderModal({ readOnly: true });

    expect(screen.getByRole('combobox', { name: 'Type' })).toBeDisabled();
  });
});
