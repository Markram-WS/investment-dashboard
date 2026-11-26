import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import MFRebalanceRecommendModal from './MFRebalanceRecommendModal';
import type { MFHolding, MFRebalanceGroup, MFRebalanceRecommendation } from '../types';

const recommendations: MFRebalanceRecommendation[] = [
  {
    symbol: 'SCBS&P500E',
    underlying: 'S&P500',
    side: 'Buy',
    qty: 12.3456,
    estimated_price: 199.8,
    estimated_value: 2466.894,
    reason: 'Underweight',
    current_allocation: 19.4,
    target_allocation: 20,
    drift: 0.6,
  },
  {
    symbol: 'SCBSEMI(E)',
    underlying: 'SEMI',
    side: 'Sell',
    qty: 10,
    estimated_price: 787.2606,
    estimated_value: 7872.606,
    reason: 'Overweight',
    current_allocation: 22,
    target_allocation: 20,
    drift: 2,
  },
];

const groups: MFRebalanceGroup[] = [
  {
    label: 'S&P500',
    current_value: 2466.894,
    target_value: 5000,
    current_pct: 19.4,
    target_pct: 20,
    drift: 0.6,
    order_value: 2466.894,
  },
  {
    label: 'SEMI',
    current_value: 7872.606,
    target_value: 7000,
    current_pct: 22,
    target_pct: 20,
    drift: 2,
    order_value: -7872.606,
  },
  {
    label: 'Balanced',
    current_value: 1000,
    target_value: 1000,
    current_pct: 10,
    target_pct: 10,
    drift: 0,
    order_value: 0,
  },
];

const holdings: MFHolding[] = [
  {
    holding_id: 1, portfolio_id: 7, asset: 'SCBS&P500E', qty: 12.3456,
    avg_entry_price: 180, current_price: 199.8, market_value: 2466.894,
    unrealized_pl: 0, unrealized_pl_pct: 0, rebalance_weight: null,
    broker_id: null, broker_code: null, underlying: 'S&P500',
  },
  {
    holding_id: 2, portfolio_id: 7, asset: 'SCBSEMI(E)', qty: 10,
    avg_entry_price: 750, current_price: 787.2606, market_value: 7872.606,
    unrealized_pl: 0, unrealized_pl_pct: 0, rebalance_weight: null,
    broker_id: null, broker_code: null, underlying: 'SEMI',
  },
  {
    holding_id: 3, portfolio_id: 7, asset: 'SCBSEMI-A', qty: 5,
    avg_entry_price: 190, current_price: 200, market_value: 1000,
    unrealized_pl: 0, unrealized_pl_pct: 0, rebalance_weight: null,
    broker_id: null, broker_code: null, underlying: 'SEMI',
  },
];

const renderModal = (overrides: Partial<ComponentProps<typeof MFRebalanceRecommendModal>> = {}) => {
  const onRecalculate = vi.fn();
  const utils = render(
    <MFRebalanceRecommendModal
      show
      loading={false}
      recommendations={recommendations}
      groups={groups}
      holdings={holdings}
      allocationBase={395267.07}
      onRecalculate={onRecalculate}
      onClose={() => {}}
      onCreateOrders={() => {}}
      {...overrides}
    />,
  );
  return { ...utils, onRecalculate };
};

describe('MFRebalanceRecommendModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the allocation base, order values and the simulation notice', () => {
    renderModal();
    expect(screen.getByText('$395,267.07')).toBeInTheDocument();
    expect(screen.getAllByText('$2,466.89').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-$7,872.61').length).toBeGreaterThan(0);
    expect(screen.getByText(/does not deposit money/i)).toBeInTheDocument();
  });

  it('renders a group row before its holdings', () => {
    renderModal();
    const sp500Group = screen.getByTestId('rebalance-group-S&P500');
    const sp500Holding = screen.getByTestId('rebalance-holding-1');
    const semiGroup = screen.getByTestId('rebalance-group-SEMI');
    const semiHolding = screen.getByTestId('rebalance-holding-2');
    const noTradeHolding = screen.getByTestId('rebalance-holding-3');

    expect(sp500Group.compareDocumentPosition(sp500Holding) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(sp500Group.compareDocumentPosition(semiGroup) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(semiGroup.compareDocumentPosition(semiHolding) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(semiHolding.compareDocumentPosition(noTradeHolding) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('shows both percentages in the allocation arrow', () => {
    renderModal();
    const row = screen.getByTestId('rebalance-group-S&P500');
    expect(within(row).getByText('19.4% → 20.0%')).toBeInTheDocument();
  });

  it('renders a balanced group with zero order value', () => {
    renderModal();
    const row = screen.getByTestId('rebalance-group-Balanced');
    expect(within(row).getByText('$0.00')).toBeInTheDocument();
  });

  it('omits qty, price and order value for a holding without a recommendation', () => {
    renderModal();
    const row = screen.getByTestId('rebalance-holding-3');
    expect(within(row).queryByText('Buy')).toBeNull();
    expect(within(row).queryByText('Sell')).toBeNull();
    const cells = within(row).getAllByRole('cell');
    expect(cells[5].textContent).toBe('');
    expect(cells[6].textContent).toBe('');
    expect(cells[7].textContent).toBe('');
  });

  it('totals the group drifts once per group', () => {
    renderModal({
      groups: [
        { ...groups[0], drift: 1.5 },
        { ...groups[1], drift: 2.25 },
      ],
    });
    expect(screen.getByText('3.8%')).toBeInTheDocument();
    expect(screen.queryByText('2.6%')).toBeNull();
  });

  it('renders an empty top-up field with a zero placeholder on open', () => {
    renderModal();
    const input = screen.getByLabelText(/Top-up cash/i) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('placeholder', '0');
  });

  it('does not recalculate on open with the default empty top-up', () => {
    const { onRecalculate } = renderModal();
    act(() => { vi.advanceTimersByTime(500); });
    expect(onRecalculate).not.toHaveBeenCalled();
  });

  it('treats a blank top-up as zero without showing an error', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '' } });
    act(() => { vi.advanceTimersByTime(500); });

    expect(onRecalculate).not.toHaveBeenCalled();
    expect(screen.queryByText('Enter a non-negative amount.')).toBeNull();
  });

  it('debounces top-up edits and recalculates with the new amount', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '100' } });
    act(() => { vi.advanceTimersByTime(349); });
    expect(onRecalculate).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(onRecalculate).toHaveBeenCalledTimes(1);
    expect(onRecalculate).toHaveBeenCalledWith(100);
  });

  it('only requests the last value while the user is still typing', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '5' } });
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.change(input, { target: { value: '500' } });
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.change(input, { target: { value: '5000' } });
    act(() => { vi.advanceTimersByTime(350); });

    expect(onRecalculate).toHaveBeenCalledTimes(1);
    expect(onRecalculate).toHaveBeenCalledWith(5000);
  });

  it('re-requests zero after a nonzero top-up is cleared back to blank', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '2500' } });
    act(() => { vi.advanceTimersByTime(350); });
    expect(onRecalculate).toHaveBeenLastCalledWith(2500);

    fireEvent.change(input, { target: { value: '' } });
    act(() => { vi.advanceTimersByTime(350); });
    expect(onRecalculate).toHaveBeenCalledTimes(2);
    expect(onRecalculate).toHaveBeenLastCalledWith(0);
  });

  it('rejects a negative top-up without requesting a recalculation', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '-5' } });
    act(() => { vi.advanceTimersByTime(500); });

    expect(onRecalculate).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a non-negative amount.')).toBeInTheDocument();
  });

  it('disables order creation while a recalculation is in flight', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('button', { name: /Create 2 Orders/i })).toBeDisabled();
  });

  it('shows a calculation error instead of the already-balanced copy', () => {
    renderModal({ recommendations: [], groups: [], error: 'Weighted sell exceeds holding value' });
    expect(screen.getByRole('alert')).toHaveTextContent('Weighted sell exceeds holding value');
    expect(screen.queryByText(/already balanced/i)).toBeNull();
  });

  it('shows the already-balanced copy when there are no groups and no recommendations', () => {
    renderModal({ recommendations: [], groups: [] });
    expect(screen.getByText(/already balanced/i)).toBeInTheDocument();
  });
});
