import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddAssetModal from './AddAssetModal';
import EditAssetModal from './EditAssetModal';
import type { AssetProduct } from '../types';

const apiMock = vi.hoisted(() => ({
  getBrokers: vi.fn(),
  createBroker: vi.fn(),
  createProduct: vi.fn(),
  createSymbol: vi.fn(),
  updateProduct: vi.fn(),
  updateSymbol: vi.fn(),
  deleteProduct: vi.fn(),
  deleteSymbol: vi.fn(),
  updateQuote: vi.fn(),
  updateSymbolPrice: vi.fn(),
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
  name: 'SET50 Future',
  symbol_count: 1,
};

const renderProductCreate = () => render(
  <AddAssetModal
    open
    mode="product"
    onClose={vi.fn()}
    onSaved={vi.fn()}
    groups={[]}
  />,
);

const openBrokerPanel = async (user: UserEvent) => {
  await user.click(screen.getByRole('button', { name: /new broker/i }));
};

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockReset());
  apiMock.getBrokers.mockResolvedValue([]);
});

describe('AddAssetModal new broker', () => {
  it('keeps the inline broker panel hidden until + New broker is clicked', async () => {
    const user = userEvent.setup();
    renderProductCreate();

    expect(screen.queryByLabelText(/broker code/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/broker name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create broker/i })).not.toBeInTheDocument();

    await openBrokerPanel(user);

    expect(screen.getByLabelText(/broker code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/broker name/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Currency' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create broker/i })).toBeInTheDocument();
    expect(screen.getByText(/becomes selectable for this product immediately/i))
      .toBeInTheDocument();
  });

  it('validates a blank code and a blank name without calling the API', async () => {
    const user = userEvent.setup();
    renderProductCreate();
    await openBrokerPanel(user);

    const create = screen.getByRole('button', { name: /create broker/i });

    await user.click(create);
    expect(apiMock.createBroker).not.toHaveBeenCalled();
    expect(screen.getByText('Broker code is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/broker code/i), 'DF');
    await user.click(create);
    expect(apiMock.createBroker).not.toHaveBeenCalled();
    expect(screen.getByText('Broker name is required')).toBeInTheDocument();
  });

  it('creates the broker, adds it to the select and confirms the code', async () => {
    const user = userEvent.setup();
    const created = {
      id: 7,
      code: 'DF',
      name: 'Phillip Securities',
      default_margin_rate: 0,
      currency: 'USD',
      created_at: null,
    };
    apiMock.createBroker.mockResolvedValue(created);
    apiMock.getBrokers.mockResolvedValue([created]);

    renderProductCreate();
    await openBrokerPanel(user);

    await user.type(screen.getByLabelText(/broker code/i), ' DF ');
    await user.type(screen.getByLabelText(/broker name/i), ' Phillip Securities ');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Currency' }), { key: 'u' });
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('USD');

    await user.click(screen.getByRole('button', { name: /create broker/i }));

    await waitFor(() => {
      expect(apiMock.createBroker).toHaveBeenCalledWith({
        code: 'DF',
        name: 'Phillip Securities',
        currency: 'USD',
      });
    });

    expect(await screen.findByText('Broker DF created')).toBeInTheDocument();
    expect(screen.queryByLabelText(/broker code/i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('DF');
    expect(apiMock.getBrokers).toHaveBeenCalledTimes(2);
  });

  it('renders the duplicate-code message from a 409 and clears it on edit', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiMock.createBroker.mockRejectedValue({
      status: 409,
      body: JSON.stringify({ detail: "Broker code 'DF' already exists" }),
    });

    renderProductCreate();
    await openBrokerPanel(user);
    await user.type(screen.getByLabelText(/broker code/i), 'DF');
    await user.type(screen.getByLabelText(/broker name/i), 'Phillip Securities');
    await user.click(screen.getByRole('button', { name: /create broker/i }));

    expect(await screen.findByText("Broker code 'DF' already exists")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create broker/i })).toBeEnabled();
    expect(screen.getByLabelText(/broker code/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/broker code/i), 'P');
    expect(screen.queryByText("Broker code 'DF' already exists")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('is absent outside product create (symbol mode and Edit product)', async () => {
    const { unmount } = render(
      <AddAssetModal
        open
        mode="symbol"
        product={product}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        groups={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: /new broker/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/broker code/i)).not.toBeInTheDocument();
    unmount();

    render(
      <EditAssetModal
        open
        mode="product"
        product={product}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        groups={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: /new broker/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/broker code/i)).not.toBeInTheDocument();
  });
});
