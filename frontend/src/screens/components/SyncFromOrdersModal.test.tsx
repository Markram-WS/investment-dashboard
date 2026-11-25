import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SyncFromOrdersModal from './SyncFromOrdersModal';
import type { AssetSyncProposal } from '../../types';

const apiMock = vi.hoisted(() => ({
  getAssetProposal: vi.fn(),
  applyAssetProposal: vi.fn(),
}));

vi.mock('../../lib/api', () => ({ api: apiMock }));

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
});

describe('Sync from orders create panel', () => {
  it('labels the create option with the proposal create symbol and asks for the underlying', async () => {
    renderSync();
    await screen.findByRole('combobox', { name: 'Assign S50H26' });

    expect(screen.getByRole('option', { name: 'Create new — S50H26' })).toBeInTheDocument();

    await openCreate();

    expect(screen.getByLabelText('Underlying for S50H26')).toHaveValue('');
    expect(screen.getByPlaceholderText('e.g. S50, or leave blank')).toBeInTheDocument();
    expect(screen.getByText('Grouping key for this contract; leave blank when the contract has no underlying.')).toBeInTheDocument();
    expect(screen.getByText(/Pick the underlying if the contract has one/)).toBeInTheDocument();
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
        }),
      ]);
    });
  });
});
