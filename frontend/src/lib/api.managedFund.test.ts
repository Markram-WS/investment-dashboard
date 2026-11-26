import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

const emptyRebalance = {
  portfolio_id: 7,
  portfolio_name: 'Fund',
  current_nav: 0,
  allocation_base: 0,
  target_allocations: {},
  current_allocations: {},
  recommendations: [],
  total_drift: 0,
};

describe('managed fund API payloads', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(okResponse(emptyRebalance));
  });

  it('sends no body for a calculate call without a top-up', async () => {
    await api.mfCalculateRebalance(7);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/managed-funds/7/rebalance/calculate');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('sends cash_top_up when a top-up is provided', async () => {
    await api.mfCalculateRebalance(7, 10000);
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ cash_top_up: 10000 });
  });

  it('sends an explicit zero top-up when zero is provided', async () => {
    await api.mfCalculateRebalance(7, 0);
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ cash_top_up: 0 });
  });

  it('passes rebalance_weight through holding updates', async () => {
    mockFetch.mockResolvedValue(okResponse({ holding_id: 9 }));
    await api.mfUpdateHolding(7, 9, { rebalance_weight: 25 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/managed-funds/7/holdings/9');
    expect(JSON.parse(init.body)).toEqual({ rebalance_weight: 25 });

    mockFetch.mockClear();
    await api.mfUpdateHolding(7, 9, { rebalance_weight: null });
    const [, clearInit] = mockFetch.mock.calls[0];
    expect(JSON.parse(clearInit.body)).toEqual({ rebalance_weight: null });
  });
});
