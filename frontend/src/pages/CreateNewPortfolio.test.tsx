import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateNewPortfolio from './CreateNewPortfolio';
import type { AssetProduct } from '../types';

const apiMock = vi.hoisted(() => ({
  getBrokers: vi.fn(),
  getProducts: vi.fn(),
  getMappingTemplates: vi.fn(),
  createPortfolio: vi.fn(),
  testConnection: vi.fn(),
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
];

const renderPage = () => render(
  <MemoryRouter>
    <CreateNewPortfolio />
  </MemoryRouter>,
);

const completeBasics = () => {
  fireEvent.change(screen.getByLabelText('Portfolio Name*'), { target: { value: 'Growth' } });
  fireEvent.click(screen.getByRole('radio', { name: /Active Trading/ }));
};

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockReset());
  apiMock.getBrokers.mockResolvedValue([piBroker]);
  apiMock.getProducts.mockResolvedValue(products);
  apiMock.getMappingTemplates.mockResolvedValue([]);
  apiMock.createPortfolio.mockResolvedValue({});
});

describe('Create portfolio identity', () => {
  it('labels Underlying, adds Type and puts — No type — first', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 220, height: 26, top: 100, left: 100, right: 320, bottom: 126, x: 100, y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    renderPage();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());
    expect(screen.getByLabelText('Underlying')).toBeInTheDocument();
    expect(screen.getByText('Underlyings this portfolio trades')).toBeInTheDocument();
    expect(screen.queryByLabelText('Multiplier')).not.toBeInTheDocument();
    expect(screen.getByText("Maps the portfolio's multiplier and margin display to this underlying · broker · type."))
      .toBeInTheDocument();

    const type = screen.getByRole('combobox', { name: 'Type' });
    fireEvent.click(type);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')[0]).toHaveTextContent('— No type —');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent))
      .toEqual(['— No type —', 'Stock', 'Future', 'Option', 'Crypto', 'Mutual Fund']);
    rect.mockRestore();
  });

  it('shows the resolved identity and posts product_type future', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());
    completeBasics();
    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Underlying'), { target: { value: 'S50' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'f' });

    expect(await screen.findByText('S50 · PI · future — multiplier 1000 · margin 10% · notional'))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    await waitFor(() => {
      expect(apiMock.createPortfolio).toHaveBeenCalledWith(expect.objectContaining({
        product_type: 'future',
      }));
    });
    const payload = apiMock.createPortfolio.mock.calls[0][0];
    expect(payload).not.toHaveProperty('x_amount');
  });

  it('posts product_type mutual_fund when Mutual Fund is selected', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());
    completeBasics();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'm' });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Mutual Fund');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    await waitFor(() => {
      expect(apiMock.createPortfolio).toHaveBeenCalledWith(expect.objectContaining({
        product_type: 'mutual_fund',
      }));
    });
  });

  it('posts product_type null when no type is selected', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());
    completeBasics();
    fireEvent.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    await waitFor(() => {
      expect(apiMock.createPortfolio).toHaveBeenCalledWith(expect.objectContaining({
        product_type: null,
      }));
    });
  });

  it('shows the fallback identity sentence when no product matches', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Underlying'), { target: { value: 'S50' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'c' });

    expect(await screen.findByText('No matching product — multiplier 1 · margin 0% will be used.'))
      .toBeInTheDocument();
  });
});

describe('Managed Fund allocation', () => {
  it('renders no JSON allocation field for a Managed Fund', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('radio', { name: /Managed Fund/ }));

    expect(document.querySelector('textarea[name="target_ratio"]')).toBeNull();
    expect(screen.queryByLabelText(/allocation ratio/i)).not.toBeInTheDocument();
  });

  it('posts a Managed Fund without a target_ratio', async () => {
    renderPage();
    await waitFor(() => expect(apiMock.getProducts).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Portfolio Name*'), { target: { value: 'Fund' } });
    fireEvent.click(screen.getByRole('radio', { name: /Managed Fund/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    await waitFor(() => expect(apiMock.createPortfolio).toHaveBeenCalled());
    const payload = apiMock.createPortfolio.mock.calls[0][0];
    expect(payload).toHaveProperty('port_type', 'Managed Fund');
    expect(payload).not.toHaveProperty('target_ratio');
  });
});
