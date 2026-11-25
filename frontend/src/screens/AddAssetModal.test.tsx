import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddAssetModal from './AddAssetModal';
import EditAssetModal from './EditAssetModal';
import type { AssetProduct, AssetSymbol } from '../types';

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

const symbol: AssetSymbol = {
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

describe('Underlying and contract copy', () => {
  it('names the product identity Underlying and marks its spec as defaults', () => {
    renderProductCreate();

    expect(screen.getByLabelText('Underlying')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ticker')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. S50, or leave blank for none')).toBeInTheDocument();
    expect(screen.getByText('Leave blank for no underlying — allowed only when a broker or a default type is set.')).toBeInTheDocument();

    expect(screen.getByLabelText('Default multiplier')).toBeInTheDocument();
    expect(screen.getByLabelText('Default margin rate')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default margin mode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default type' })).toBeInTheDocument();
    expect(screen.getAllByText('Inherited by every contract unless the contract overrides it.')).toHaveLength(4);
  });

  it('rejects a blank underlying with no broker and no default type', async () => {
    const user = userEvent.setup();
    renderProductCreate();

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(apiMock.createProduct).not.toHaveBeenCalled();
    expect(screen.getByText('Ticker is required')).toBeInTheDocument();
  });

  it('creates a product with a blank underlying when a broker is set', async () => {
    const user = userEvent.setup();
    const broker = {
      id: 1,
      code: 'PI',
      name: 'Phillip Securities',
      default_margin_rate: 0,
      currency: 'THB',
      created_at: null,
    };
    apiMock.getBrokers.mockResolvedValue([broker]);
    apiMock.createProduct.mockResolvedValue({});

    renderProductCreate();
    const brokerSelect = screen.getByRole('combobox', { name: 'Broker' });
    await waitFor(() => {
      fireEvent.keyDown(brokerSelect, { key: 'P' });
      expect(brokerSelect).toHaveTextContent('PI');
    });

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => {
      expect(apiMock.createProduct).toHaveBeenCalledWith(expect.objectContaining({
        ticker: undefined,
        broker_id: 1,
        asset_type: null,
      }));
    });
  });

  it('renames the edit product spec fields to underlying defaults', () => {
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

    expect(screen.getByLabelText(/^Underlying/)).toHaveValue('S50');
    expect(screen.getByLabelText('Default multiplier')).toHaveValue(1000);
    expect(screen.getByLabelText('Default margin rate')).toHaveValue(0.1);
    expect(screen.getByRole('combobox', { name: 'Default margin mode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default type' })).toBeInTheDocument();
    expect(screen.getAllByText('Inherited by every contract unless the contract overrides it.')).toHaveLength(4);
  });

  it('clears the underlying with an empty ticker when a broker is set', async () => {
    const user = userEvent.setup();
    apiMock.updateProduct.mockResolvedValue({});

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

    await user.clear(screen.getByLabelText('Underlying'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiMock.updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ ticker: '' }));
    });
  });

  it('rejects clearing the underlying with no broker and no default type', async () => {
    const user = userEvent.setup();
    const unassigned = { ...product, broker_id: null, broker_code: null, asset_type: null };

    render(
      <EditAssetModal
        open
        mode="product"
        product={unassigned}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        groups={[]}
      />,
    );

    await user.clear(screen.getByLabelText('Underlying'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(apiMock.updateProduct).not.toHaveBeenCalled();
    expect(screen.getByText('Ticker is required')).toBeInTheDocument();
  });

  it('shows the inherited default values on the contract override fields', () => {
    render(
      <EditAssetModal
        open
        mode="symbol"
        product={product}
        symbol={symbol}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        groups={[]}
      />,
    );

    expect(screen.getByLabelText('Ticker')).toHaveValue('S50H26');
    expect(screen.getByText('This contract can override the underlying defaults.')).toBeInTheDocument();
    expect(screen.getByLabelText('Multiplier (this contract)')).toBeInTheDocument();
    expect(screen.getByLabelText('Margin rate (this contract)')).toBeInTheDocument();
    expect(screen.getByText('Empty = inherit the underlying default (1000).')).toBeInTheDocument();
    expect(screen.getByText('Empty = inherit the underlying default (10%).')).toBeInTheDocument();
    expect(screen.getByLabelText('Margin per contract (span)')).toBeInTheDocument();
  });
});
