import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddAssetModal from './AddAssetModal';
import EditAssetModal from './EditAssetModal';
import type { AssetProduct, AssetSymbol } from '../types';

const apiMock = vi.hoisted(() => ({
  getBrokers: vi.fn(),
  getProducts: vi.fn(),
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

const piBroker = {
  id: 1,
  code: 'PI',
  name: 'Phillip Securities',
  default_margin_rate: 0,
  currency: 'THB',
  created_at: null,
};

const dfBroker = {
  id: 2,
  code: 'DF',
  name: 'Finansia Syrus',
  default_margin_rate: 0,
  currency: 'THB',
  created_at: null,
};

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

const dfProduct: AssetProduct = {
  product_id: 2,
  ticker: 'S50',
  broker_id: 2,
  broker_code: 'DF',
  asset_type: 'future',
  multiplier: 2000,
  margin_rate: 0.2,
  margin_mode: 'span',
  margin_per_contract: 750,
  source: 'tfex',
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
  margin_rate: 0.05,
  margin_mode: 'notional',
  source: 'manual',
  group_id: null,
  name: null,
  symbol_count: 1,
};

const pttStock: AssetProduct = {
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

const optionProduct: AssetProduct = {
  product_id: 3,
  ticker: 'S50',
  broker_id: 1,
  broker_code: 'PI',
  asset_type: 'option',
  multiplier: 1000,
  margin_rate: 0.1,
  margin_mode: 'notional',
  source: 'tfex',
  group_id: null,
  name: null,
  symbol_count: 0,
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
  multiplier_override: 3,
  margin_rate_override: 0.25,
  margin_per_contract: 500,
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
  />,
);

const renderSymbolCreate = (owner: AssetProduct) => render(
  <AddAssetModal
    open
    mode="symbol"
    product={owner}
    onClose={vi.fn()}
    onSaved={vi.fn()}
  />,
);

const renderSymbolEditFor = (owner: AssetProduct, owned: AssetSymbol) => render(
  <EditAssetModal
    open
    mode="symbol"
    product={owner}
    symbol={owned}
    onClose={vi.fn()}
    onSaved={vi.fn()}
  />,
);

const renderSymbolEdit = () => renderSymbolEditFor(product, symbol);

const waitForBrokerOptions = async () => {
  const input = screen.getByLabelText('Broker');
  fireEvent.focus(input);
  await screen.findByRole('option', { name: 'PI' });
  fireEvent.keyDown(input, { key: 'Escape' });
};

const pttStockSymbol: AssetSymbol = {
  ...symbol,
  symbol_id: 21,
  product_id: 6,
  price_symbol: 'PTTZ25',
  sync_symbol: 'PTTZ25',
  contract_kind: 'stock',
  multiplier_override: null,
  margin_rate_override: null,
  margin_per_contract: null,
  multiplier_effective: 1,
  margin_rate_effective: 0,
  price: 35,
  change_24h: 0.8,
};

const productNoSymbols: AssetProduct = {
  ...product,
  symbol_count: 0,
};

const createdFuture: AssetProduct = {
  ...pttStock,
  product_id: 9,
  asset_type: 'future',
  source: 'yfinance',
  symbol_count: 0,
};

const defaultProduct: AssetProduct = {
  ...product,
  product_id: 10,
  ticker: null,
  broker_id: null,
  broker_code: null,
  asset_type: null,
  multiplier: 1,
  margin_rate: 0,
  margin_mode: 'notional',
  source: '-',
  name: null,
  symbol_count: 0,
};

const optionSymbol: AssetSymbol = {
  ...symbol,
  symbol_id: 13,
  product_id: 3,
  price_symbol: 'S50O26',
  sync_symbol: 'S50O26',
  contract_kind: 'option',
  option_type: 'Call',
  expiry_date: '2026-06-19',
  strike_price: 30,
};

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockReset());
  apiMock.getBrokers.mockResolvedValue([piBroker, dfBroker]);
  apiMock.getProducts.mockResolvedValue([product, dfProduct, optionProduct, nullUnderlyingProduct, pttStock]);
});

describe('AddAssetModal broker combobox', () => {
  it('matches an existing code case-insensitively and posts no broker', async () => {
    const user = userEvent.setup();
    apiMock.createProduct.mockResolvedValue({});

    renderProductCreate();
    await waitForBrokerOptions();
    await user.type(screen.getByLabelText('Broker'), 'pI');

    expect(screen.queryByText(/New broker ·/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => {
      expect(apiMock.createProduct).toHaveBeenCalledWith(expect.objectContaining({ broker_id: 1 }));
    });
    expect(apiMock.createBroker).not.toHaveBeenCalled();
  });

  it('reveals the new-broker confirm row and creates the broker before the product', async () => {
    const user = userEvent.setup();
    const createdBroker = {
      id: 9,
      code: 'zz',
      name: 'zz',
      default_margin_rate: 0,
      currency: 'THB',
      created_at: null,
    };
    apiMock.createBroker.mockResolvedValue(createdBroker);
    apiMock.createProduct.mockResolvedValue({});

    renderProductCreate();
    await waitForBrokerOptions();
    const brokerInput = screen.getByLabelText('Broker');
    await user.type(brokerInput, 'zz');

    expect(screen.getByText('New broker · zz')).toBeInTheDocument();
    expect(screen.getByText('Creates this broker with the typed code as its name.')).toBeInTheDocument();
    const currency = screen.getByRole('combobox', { name: 'Currency' });
    expect(currency).toHaveValue('THB');
    fireEvent.change(currency, { target: { value: 'USD' } });

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => {
      expect(apiMock.createBroker).toHaveBeenCalledWith({ code: 'zz', name: 'zz', currency: 'USD' });
    });
    await waitFor(() => {
      expect(apiMock.createProduct).toHaveBeenCalledWith(expect.objectContaining({ broker_id: 9 }));
    });
  });

  it('shows a 409 inline and adopts the existing broker on the next submit', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const existingBroker = {
      id: 8,
      code: 'ZZ',
      name: 'ZZ',
      default_margin_rate: 0,
      currency: 'THB',
      created_at: null,
    };
    apiMock.getBrokers.mockReset();
    apiMock.getBrokers
      .mockResolvedValueOnce([piBroker, dfBroker])
      .mockResolvedValue([piBroker, dfBroker, existingBroker]);
    apiMock.createBroker.mockRejectedValue({
      status: 409,
      body: JSON.stringify({ detail: "Broker code 'ZZ' already exists" }),
    });
    apiMock.createProduct.mockResolvedValue({});

    renderProductCreate();
    await waitForBrokerOptions();
    await user.type(screen.getByLabelText('Broker'), 'ZZ');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByText("Broker code 'ZZ' already exists")).toBeInTheDocument();
    const brokerInput = screen.getByLabelText('Broker');
    fireEvent.focus(brokerInput);
    await screen.findByRole('listbox', { name: 'Brokers' });
    expect(screen.queryByText('New broker · ZZ')).not.toBeInTheDocument();
    fireEvent.keyDown(brokerInput, { key: 'Escape' });
    expect(brokerInput).toHaveValue('ZZ');
    expect(apiMock.createProduct).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => {
      expect(apiMock.createProduct).toHaveBeenCalledWith(expect.objectContaining({ broker_id: 8 }));
    });
    expect(apiMock.createBroker).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('sends a null broker id when the combobox is blank', async () => {
    const user = userEvent.setup();
    apiMock.createProduct.mockResolvedValue({});

    renderProductCreate();
    await waitForBrokerOptions();
    await user.type(screen.getByLabelText('Underlying'), 'S50');

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => {
      expect(apiMock.createProduct).toHaveBeenCalledWith(expect.objectContaining({ broker_id: null }));
    });
    expect(apiMock.createBroker).not.toHaveBeenCalled();
  });

  it('no longer renders the old + New broker control anywhere', () => {
    renderProductCreate();
    expect(screen.queryByRole('button', { name: /new broker/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/broker code/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/broker name/i)).not.toBeInTheDocument();
  });

  it('filters the in-page listbox, highlights an exact code and commits with Enter', async () => {
    renderProductCreate();
    await waitForBrokerOptions();
    const brokerInput = screen.getByLabelText('Broker');

    fireEvent.focus(brokerInput);
    const listbox = await screen.findByRole('listbox', { name: 'Brokers' });
    expect(brokerInput).toHaveAttribute('aria-expanded', 'true');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent))
      .toEqual(['— Unassigned —', 'DF', 'PI']);

    fireEvent.change(brokerInput, { target: { value: 'df' } });
    expect(within(listbox).getAllByRole('option').map(option => option.textContent))
      .toEqual(['DF']);

    fireEvent.change(brokerInput, { target: { value: 'PI' } });
    const option = within(listbox).getByRole('option', { name: 'PI' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(brokerInput).toHaveAttribute('aria-activedescendant', option.id);

    fireEvent.keyDown(brokerInput, { key: 'Enter' });
    expect(brokerInput).toHaveValue('PI');
    expect(screen.queryByRole('listbox', { name: 'Brokers' })).not.toBeInTheDocument();
  });

  it('moves the highlight with arrows, closes on Escape and commits on click', async () => {
    const user = userEvent.setup();
    renderProductCreate();
    await waitForBrokerOptions();
    const brokerInput = screen.getByLabelText('Broker');

    fireEvent.focus(brokerInput);
    const listbox = await screen.findByRole('listbox', { name: 'Brokers' });
    fireEvent.keyDown(brokerInput, { key: 'ArrowDown' });
    expect(within(listbox).getByRole('option', { name: 'DF' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(brokerInput, { key: 'ArrowUp' });
    expect(within(listbox).getByRole('option', { name: '— Unassigned —' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(brokerInput, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Brokers' })).not.toBeInTheDocument();

    fireEvent.focus(brokerInput);
    const reopened = await screen.findByRole('listbox', { name: 'Brokers' });
    const pi = within(reopened).getByRole('option', { name: 'PI' });
    fireEvent.mouseDown(pi);
    await waitFor(() => expect(brokerInput).toHaveValue('PI'));
    expect(screen.queryByRole('listbox', { name: 'Brokers' })).not.toBeInTheDocument();
    expect(user).toBeTruthy();
  });
});

describe('Product create modal', () => {
  it('titles the modal Add product and owns the product spec without a Name field', () => {
    renderProductCreate();

    expect(screen.getByRole('heading', { name: 'Add product' })).toBeInTheDocument();
    expect(screen.getByLabelText('Underlying')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Optional display name')).not.toBeInTheDocument();

    expect(screen.getByLabelText('Multiplier')).toBeInTheDocument();
    expect(screen.getByLabelText('Margin rate')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Margin mode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Group' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Margin per contract')).not.toBeInTheDocument();
    expect(screen.getAllByText('Inherited by every contract unless the contract overrides it.')).toHaveLength(4);
  });

  it('shows Margin per contract only for span mode and posts it', async () => {
    const user = userEvent.setup();
    apiMock.createProduct.mockResolvedValue({});

    renderProductCreate();
    expect(screen.queryByLabelText('Margin per contract')).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Margin mode' }), { key: 's' });

    expect(await screen.findByLabelText('Margin per contract')).toBeInTheDocument();
    expect(screen.getByText('Used by span mode: qty × this value.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Margin per contract'), '750');
    await waitForBrokerOptions();
    await user.type(screen.getByLabelText('Broker'), 'PI');

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => {
      expect(apiMock.createProduct).toHaveBeenCalledWith(expect.objectContaining({
        margin_mode: 'span',
        margin_per_contract: 750,
      }));
    });
  });

  it('rejects a blank underlying with no broker and no default type', async () => {
    const user = userEvent.setup();
    renderProductCreate();

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(apiMock.createProduct).not.toHaveBeenCalled();
    expect(screen.getByText('Ticker is required')).toBeInTheDocument();
  });

  it('creates a product with a blank underlying when a broker is set and never sends a name', async () => {
    const user = userEvent.setup();
    apiMock.createProduct.mockResolvedValue({});

    renderProductCreate();
    await waitForBrokerOptions();
    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: 'PI' } });
    expect(screen.getByLabelText('Broker')).toHaveValue('PI');

    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => {
      expect(apiMock.createProduct).toHaveBeenCalledWith(expect.objectContaining({
        ticker: undefined,
        broker_id: 1,
        asset_type: null,
      }));
    });
    const payload = apiMock.createProduct.mock.calls[0][0];
    expect(payload).not.toHaveProperty('group_id');
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('margin_per_contract');
  });

  it('renames the edit product spec fields to underlying defaults without a Name field', async () => {
    const user = userEvent.setup();
    apiMock.updateProduct.mockResolvedValue({});

    render(
      <EditAssetModal
        open
        mode="product"
        product={product}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^Underlying/)).toHaveValue('S50');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Multiplier')).toHaveValue(1000);
    expect(screen.getByLabelText('Margin rate')).toHaveValue(0.1);
    expect(screen.getByRole('combobox', { name: 'Margin mode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Group' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Margin per contract')).not.toBeInTheDocument();
    expect(screen.getAllByText('Inherited by every contract unless the contract overrides it.')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(apiMock.updateProduct.mock.calls[0][1]).not.toHaveProperty('name');
    expect(apiMock.updateProduct.mock.calls[0][1]).not.toHaveProperty('margin_per_contract');
  });

  it('shows and posts the span Margin per contract on edit', async () => {
    const user = userEvent.setup();
    apiMock.updateProduct.mockResolvedValue({});

    render(
      <EditAssetModal
        open
        mode="product"
        product={dfProduct}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Margin per contract')).toHaveValue(750);
    expect(screen.getByText('Used by span mode: qty × this value.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiMock.updateProduct).toHaveBeenCalledWith(2, expect.objectContaining({
        margin_mode: 'span',
        margin_per_contract: 750,
      }));
    });
  });

  it('updates to an existing broker without creating one', async () => {
    const user = userEvent.setup();
    apiMock.updateProduct.mockResolvedValue({});

    render(
      <EditAssetModal
        open
        mode="product"
        product={productNoSymbols}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await waitForBrokerOptions();
    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: 'DF' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiMock.updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ broker_id: 2 }));
    });
    expect(apiMock.createBroker).not.toHaveBeenCalled();
  });

  it('creates a new broker then updates the product with its id', async () => {
    const user = userEvent.setup();
    const createdBroker = {
      id: 9,
      code: 'ZZ',
      name: 'ZZ',
      default_margin_rate: 0,
      currency: 'THB',
      created_at: null,
    };
    apiMock.createBroker.mockResolvedValue(createdBroker);
    apiMock.updateProduct.mockResolvedValue({});

    render(
      <EditAssetModal
        open
        mode="product"
        product={productNoSymbols}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await waitForBrokerOptions();
    const broker = screen.getByLabelText('Broker');
    fireEvent.change(broker, { target: { value: 'ZZ' } });
    expect(screen.getByText('New broker · ZZ')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiMock.createBroker).toHaveBeenCalledWith({ code: 'ZZ', name: 'ZZ', currency: 'THB' });
    });
    await waitFor(() => {
      expect(apiMock.updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ broker_id: 9 }));
    });
  });

  it('blocks a broker change while contracts are attached and keeps the field focused', async () => {
    const user = userEvent.setup();

    render(
      <EditAssetModal
        open
        mode="product"
        product={product}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await waitForBrokerOptions();
    const broker = screen.getByLabelText('Broker');
    fireEvent.change(broker, { target: { value: 'ZZ' } });
    fireEvent.keyDown(broker, { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Cannot change the broker while 1 contract(s) are attached — move or delete them first.'))
      .toBeInTheDocument();
    expect(broker).toHaveFocus();
    expect(apiMock.createBroker).not.toHaveBeenCalled();
    expect(apiMock.updateProduct).not.toHaveBeenCalled();
  });

  it('shows a broker 409 inline and adopts the existing broker for the next save', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const existingBroker = {
      id: 8,
      code: 'ZZ',
      name: 'ZZ',
      default_margin_rate: 0,
      currency: 'THB',
      created_at: null,
    };
    apiMock.getBrokers.mockReset();
    apiMock.getBrokers
      .mockResolvedValueOnce([piBroker, dfBroker])
      .mockResolvedValue([piBroker, dfBroker, existingBroker]);
    apiMock.createBroker.mockRejectedValue({
      status: 409,
      body: JSON.stringify({ detail: "Broker code 'ZZ' already exists" }),
    });
    apiMock.updateProduct.mockResolvedValue({});

    render(
      <EditAssetModal
        open
        mode="product"
        product={productNoSymbols}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await waitForBrokerOptions();
    const broker = screen.getByLabelText('Broker');
    fireEvent.change(broker, { target: { value: 'ZZ' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("Broker code 'ZZ' already exists")).toBeInTheDocument();
    fireEvent.focus(broker);
    await screen.findByRole('listbox', { name: 'Brokers' });
    expect(screen.queryByText('New broker · ZZ')).not.toBeInTheDocument();
    fireEvent.keyDown(broker, { key: 'Escape' });
    expect(apiMock.updateProduct).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(apiMock.updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ broker_id: 8 }));
    });
    expect(apiMock.createBroker).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
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
      />,
    );

    await user.clear(screen.getByLabelText('Underlying'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiMock.updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ ticker: '' }));
    });
    expect(apiMock.updateProduct.mock.calls[0][1]).not.toHaveProperty('group_id');
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
      />,
    );

    await user.clear(screen.getByLabelText('Underlying'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(apiMock.updateProduct).not.toHaveBeenCalled();
    expect(screen.getByText('Ticker is required')).toBeInTheDocument();
  });
});

describe('Unified identity null entries', () => {
  const rectSpy = () => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 200,
    height: 26,
    top: 100,
    left: 100,
    right: 300,
    bottom: 126,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect);

  const expectNullFirst = (name: string, label: string) => {
    const trigger = screen.getByRole('combobox', { name });
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')[0]).toHaveTextContent(label);
    fireEvent.keyDown(trigger, { key: 'Escape' });
  };

  it('puts the unified null entries first in both symbol modals', async () => {
    const spy = rectSpy();
    const { unmount } = renderSymbolCreate(product);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    });
    expectNullFirst('Underlying', '— No underlying —');
    expectNullFirst('Broker', '— Unassigned —');
    expectNullFirst('Type', '— No type —');
    unmount();

    renderSymbolEdit();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    });
    expectNullFirst('Underlying', '— No underlying —');
    expectNullFirst('Broker', '— Unassigned —');
    expectNullFirst('Type', '— No type —');
    spy.mockRestore();
  });

  it('puts — No type — first in both product Type selects', () => {
    const spy = rectSpy();
    const { unmount } = renderProductCreate();
    const addType = screen.getByRole('combobox', { name: 'Type' });
    fireEvent.click(addType);
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0])
      .toHaveTextContent('— No type —');
    fireEvent.keyDown(addType, { key: 'Escape' });
    unmount();

    render(
      <EditAssetModal
        open
        mode="product"
        product={product}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const editType = screen.getByRole('combobox', { name: 'Type' });
    fireEvent.click(editType);
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0])
      .toHaveTextContent('— No type —');
    fireEvent.keyDown(editType, { key: 'Escape' });
    spy.mockRestore();
  });
});

describe('Symbol modal product resolution', () => {
  it('picks the product with three dropdowns and reads back its spec, with no multiplier or margin input', async () => {
    renderSymbolEdit();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    });
    expect(screen.getByRole('combobox', { name: 'Underlying' })).toHaveTextContent('S50');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Future');

    expect(screen.getByText('S50 · PI · future')).toBeInTheDocument();
    expect(screen.getByText('Multiplier 1000 · Margin rate 10% · Mode notional · Source tfex'))
      .toBeInTheDocument();

    expect(screen.queryByLabelText(/multiplier/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/margin rate/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contract kind')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Margin per contract (span)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Option type')).not.toBeInTheDocument();
  });

  it('offers inline creation for an unmatched identity and requires a price source', async () => {
    renderSymbolEdit();

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'c' });

    expect(await screen.findByText('No product matches — this will create S50 · PI · crypto.'))
      .toBeInTheDocument();
    expect(screen.getByText('New products start at multiplier 1, margin 0%, mode notional.'))
      .toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Price source/ })).toHaveTextContent('Choose…');
    expect(screen.queryByText('No product matches Underlying + Broker + Type — create it with + New product.'))
      .not.toBeInTheDocument();

    const primary = screen.getByRole('button', { name: 'Create product & apply' });
    expect(primary).toBeDisabled();

    fireEvent.keyDown(screen.getByRole('combobox', { name: /Price source/ }), { key: 'y' });
    expect(screen.getByRole('combobox', { name: /Price source/ })).toHaveTextContent('yfinance');
    expect(primary).toBeEnabled();
  });

  it('creates the missing product and then the symbol under it', async () => {
    const user = userEvent.setup();
    apiMock.createProduct.mockResolvedValue(createdFuture);
    apiMock.createSymbol.mockResolvedValue({});

    renderSymbolCreate(product);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Underlying' })).toHaveTextContent('S50');
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Underlying' }), { key: 'p' });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Broker' }), { key: 'd' });

    expect(await screen.findByText('No product matches — this will create PTT · DF · future.'))
      .toBeInTheDocument();
    await user.type(screen.getByLabelText(/Sync symbol/), 'PTTZ25');
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Price source/ }), { key: 'y' });
    await user.click(screen.getByRole('button', { name: 'Create product & apply' }));

    await waitFor(() => expect(apiMock.createProduct).toHaveBeenCalledTimes(1));
    expect(apiMock.createProduct).toHaveBeenCalledWith({
      ticker: 'PTT',
      broker_id: 2,
      asset_type: 'future',
      source: 'yfinance',
      multiplier: 1,
      margin_rate: 0,
      margin_mode: 'notional',
    });
    await waitFor(() => expect(apiMock.createSymbol).toHaveBeenCalledTimes(1));
    const [productId, payload] = apiMock.createSymbol.mock.calls[0];
    expect(productId).toBe(9);
    expect(payload).toMatchObject({ sync_symbol: 'PTTZ25' });
    expect(payload).not.toHaveProperty('contract_kind');
    expect(payload).not.toHaveProperty('margin_per_contract');
  });

  it('creates the missing identity and moves an existing symbol to it', async () => {
    const user = userEvent.setup();
    apiMock.getProducts.mockResolvedValue([product, dfProduct, optionProduct, nullUnderlyingProduct, pttStock]);
    apiMock.createProduct.mockResolvedValue(createdFuture);
    apiMock.updateSymbol.mockResolvedValue({});

    renderSymbolEditFor(pttStock, pttStockSymbol);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Stock');
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'f' });

    expect(await screen.findByText('No product matches — this will create PTT · PI · future.'))
      .toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Price source/ }), { key: 'y' });
    await user.click(screen.getByRole('button', { name: 'Create product & apply' }));

    await waitFor(() => expect(apiMock.createProduct).toHaveBeenCalledWith({
      ticker: 'PTT',
      broker_id: 1,
      asset_type: 'future',
      source: 'yfinance',
      multiplier: 1,
      margin_rate: 0,
      margin_mode: 'notional',
    }));
    await waitFor(() => expect(apiMock.updateSymbol).toHaveBeenCalledTimes(1));
    const [symbolId, payload] = apiMock.updateSymbol.mock.calls[0];
    expect(symbolId).toBe(21);
    expect(payload).toMatchObject({ product_id: 9, sync_symbol: 'PTTZ25' });
    expect(payload).not.toHaveProperty('contract_kind');
    expect(payload).not.toHaveProperty('margin_per_contract');
  });

  it('keeps the form and shows the server detail when the product already exists', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiMock.createProduct.mockRejectedValue({
      status: 400,
      body: JSON.stringify({ detail: 'An asset with this ticker already exists' }),
    });

    renderSymbolEdit();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'c' });
    await screen.findByText('No product matches — this will create S50 · PI · crypto.');
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Price source/ }), { key: 'y' });
    await user.click(screen.getByRole('button', { name: 'Create product & apply' }));

    expect(await screen.findByText('An asset with this ticker already exists')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Crypto');
    expect(screen.getByRole('combobox', { name: /Price source/ })).toHaveTextContent('yfinance');
    expect(screen.getByRole('button', { name: 'Create product & apply' })).toBeEnabled();
    expect(apiMock.createSymbol).not.toHaveBeenCalled();
    expect(apiMock.updateSymbol).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('does not offer creation for the existing all-dash default identity', async () => {
    apiMock.getProducts.mockResolvedValue([defaultProduct, product, pttStock]);

    renderSymbolEdit();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Underlying' }), { key: '—' });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Broker' }), { key: '—' });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: '—' });

    expect(await screen.findByText('— · Unassigned · —')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Price source/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('creates a symbol under the resolved product without multiplier or margin overrides', async () => {
    const user = userEvent.setup();
    apiMock.createSymbol.mockResolvedValue({});

    renderSymbolCreate(product);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Underlying' })).toHaveFocus();
    });
    await user.type(screen.getByLabelText(/Sync symbol/), 'S50H26');
    await user.click(screen.getByRole('button', { name: 'Create symbol' }));
    await waitFor(() => expect(apiMock.createSymbol).toHaveBeenCalledTimes(1));
    const [productId, payload] = apiMock.createSymbol.mock.calls[0];
    expect(productId).toBe(1);
    expect(payload).not.toHaveProperty('multiplier_override');
    expect(payload).not.toHaveProperty('margin_rate_override');
    expect(payload).not.toHaveProperty('contract_kind');
    expect(payload).not.toHaveProperty('margin_per_contract');
    expect(payload).not.toHaveProperty('option_type');
    expect(payload).not.toHaveProperty('expiry_date');
    expect(payload).not.toHaveProperty('strike_price');
    expect(payload).toMatchObject({ sync_symbol: 'S50H26' });
  });

  it('keeps the update payload free of product_id when the product is unchanged', async () => {
    const user = userEvent.setup();
    apiMock.updateSymbol.mockResolvedValue({});

    renderSymbolEdit();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiMock.updateSymbol).toHaveBeenCalledTimes(1));
    const [, payload] = apiMock.updateSymbol.mock.calls[0];
    expect(payload).not.toHaveProperty('product_id');
    expect(payload).not.toHaveProperty('multiplier_override');
    expect(payload).not.toHaveProperty('margin_rate_override');
    expect(payload).not.toHaveProperty('contract_kind');
    expect(payload).not.toHaveProperty('margin_per_contract');
    expect(payload).toMatchObject({ sync_symbol: 'S50H26' });
  });

  it('starts on the first available product when no owner is preselected', async () => {
    render(
      <AddAssetModal
        open
        mode="symbol"
        product={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByRole('combobox', { name: 'Underlying' })).toHaveTextContent('S50');
    expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Future');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create symbol' })).toBeEnabled());
  });

  it('starts empty and keeps Save disabled when there is no product to resolve', async () => {
    apiMock.getProducts.mockResolvedValue([]);
    render(
      <AddAssetModal
        open
        mode="symbol"
        product={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByRole('combobox', { name: 'Underlying' })).toHaveTextContent('— No underlying —');
    expect(screen.getByText('No product matches Underlying + Broker + Type — create it with + New product.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create symbol' })).toBeDisabled();
  });

  it('shows option terms only for an option identity and clears them when switching away', async () => {
    const user = userEvent.setup();
    renderSymbolCreate(optionProduct);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Option');
    });
    expect(await screen.findByText('S50 · PI · option')).toBeInTheDocument();
    expect(screen.getByLabelText('Option type')).toBeInTheDocument();
    expect(screen.getByLabelText('Expiry date')).toBeInTheDocument();
    expect(screen.getByLabelText('Strike price')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText('Option type'), { key: 'c' });
    fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2026-06-19' } });
    await user.type(screen.getByLabelText('Strike price'), '30');

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'f' });
    expect(await screen.findByText('S50 · PI · future')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Option type')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Expiry date')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Strike price')).not.toBeInTheDocument();
    });

    await new Promise(resolve => setTimeout(resolve, 650));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'o' });
    expect(await screen.findByLabelText('Option type')).toBeInTheDocument();
    expect(screen.getByLabelText('Option type')).toHaveTextContent('—');
    expect(screen.getByLabelText('Expiry date')).toHaveValue('');
    expect(screen.getByLabelText('Strike price')).toHaveValue(null);
  });

  it('posts option terms only for an option identity', async () => {
    const user = userEvent.setup();
    apiMock.createSymbol.mockResolvedValue({});

    renderSymbolCreate(optionProduct);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Option');
    });
    expect(await screen.findByText('S50 · PI · option')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Sync symbol/), 'S50O26');
    fireEvent.keyDown(screen.getByLabelText('Option type'), { key: 'c' });
    fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2026-06-19' } });
    await user.type(screen.getByLabelText('Strike price'), '30');
    await user.click(screen.getByRole('button', { name: 'Create symbol' }));

    await waitFor(() => expect(apiMock.createSymbol).toHaveBeenCalledTimes(1));
    const [productId, payload] = apiMock.createSymbol.mock.calls[0];
    expect(productId).toBe(3);
    expect(payload).toMatchObject({
      sync_symbol: 'S50O26',
      option_type: 'Call',
      expiry_date: '2026-06-19',
      strike_price: 30,
    });
    expect(payload).not.toHaveProperty('contract_kind');
    expect(payload).not.toHaveProperty('margin_per_contract');
  });

  it('drops option terms when an edited option symbol moves to a non-option identity', async () => {
    const user = userEvent.setup();
    apiMock.updateSymbol.mockResolvedValue({});

    renderSymbolEditFor(optionProduct, optionSymbol);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Option');
    });
    expect(await screen.findByText('S50 · PI · option')).toBeInTheDocument();
    expect(screen.getByLabelText('Option type')).toHaveTextContent('Call');
    expect(screen.getByLabelText('Expiry date')).toHaveValue('2026-06-19');
    expect(screen.getByLabelText('Strike price')).toHaveValue(30);

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Type' }), { key: 'f' });
    expect(await screen.findByText('S50 · PI · future')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiMock.updateSymbol).toHaveBeenCalledTimes(1));
    const [, payload] = apiMock.updateSymbol.mock.calls[0];
    expect(payload).toMatchObject({ product_id: 1, sync_symbol: 'S50O26' });
    expect(payload).not.toHaveProperty('option_type');
    expect(payload).not.toHaveProperty('expiry_date');
    expect(payload).not.toHaveProperty('strike_price');
    expect(payload).not.toHaveProperty('contract_kind');
    expect(payload).not.toHaveProperty('margin_per_contract');
  });

  it('sends product_id only when the dropdowns resolve a different product', async () => {
    const user = userEvent.setup();
    apiMock.updateSymbol.mockResolvedValue({});

    renderSymbolEdit();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Broker' }), { key: 'D' });

    expect(await screen.findByText('S50 · DF · future')).toBeInTheDocument();
    expect(screen.getByText('Multiplier 2000 · Margin rate 20% · Mode span · Source tfex'))
      .toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiMock.updateSymbol).toHaveBeenCalledTimes(1));
    const [, payload] = apiMock.updateSymbol.mock.calls[0];
    expect(payload).toMatchObject({ product_id: 2, sync_symbol: 'S50H26' });
  });

  it('selects a NULL-ticker product through — No underlying — and posts to it', async () => {
    const user = userEvent.setup();
    apiMock.createSymbol.mockResolvedValue({});

    renderSymbolCreate(nullUnderlyingProduct);

    expect(screen.getByRole('combobox', { name: 'Underlying' })).toHaveTextContent('— No underlying —');
    expect(screen.getByText('— · Unassigned · future')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Underlying' })).toHaveFocus();
    });
    await user.type(screen.getByLabelText(/Sync symbol/), 'XAUUSD');
    await user.click(screen.getByRole('button', { name: 'Create symbol' }));

    await waitFor(() => expect(apiMock.createSymbol).toHaveBeenCalledTimes(1));
    expect(apiMock.createSymbol.mock.calls[0][0]).toBe(4);
  });

  it('moves an existing symbol onto a NULL-ticker product via — No underlying —', async () => {
    const user = userEvent.setup();
    apiMock.updateSymbol.mockResolvedValue({});

    renderSymbolEdit();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Broker' })).toHaveTextContent('PI');
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Underlying' }), { key: '—' });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Broker' }), { key: '—' });

    expect(await screen.findByText('— · Unassigned · future')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiMock.updateSymbol).toHaveBeenCalledTimes(1));
    expect(apiMock.updateSymbol.mock.calls[0][1]).toMatchObject({ product_id: 4 });
  });
});
