import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MFRebalanceRecommendModal from './MFRebalanceRecommendModal';
import type { MFRebalanceRecommendation } from '../types';

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

const renderModal = (overrides: Partial<ComponentProps<typeof MFRebalanceRecommendModal>> = {}) => {
  const onRecalculate = vi.fn();
  const utils = render(
    <MFRebalanceRecommendModal
      show
      loading={false}
      recommendations={recommendations}
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
    expect(screen.getByText('$2,466.89')).toBeInTheDocument();
    expect(screen.getByText('$7,872.61')).toBeInTheDocument();
    expect(screen.getByText(/does not deposit money/i)).toBeInTheDocument();
  });

  it('does not recalculate on open with the default zero top-up', () => {
    const { onRecalculate } = renderModal();
    act(() => { vi.advanceTimersByTime(500); });
    expect(onRecalculate).not.toHaveBeenCalled();
  });

  it('debounces top-up edits and recalculates with the new amount', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '5000' } });
    act(() => { vi.advanceTimersByTime(349); });
    expect(onRecalculate).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(onRecalculate).toHaveBeenCalledTimes(1);
    expect(onRecalculate).toHaveBeenCalledWith(5000);
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

  it('re-requests zero after a nonzero top-up is cleared back to zero', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '2500' } });
    act(() => { vi.advanceTimersByTime(350); });
    expect(onRecalculate).toHaveBeenLastCalledWith(2500);

    fireEvent.change(input, { target: { value: '0' } });
    act(() => { vi.advanceTimersByTime(350); });
    expect(onRecalculate).toHaveBeenCalledTimes(2);
    expect(onRecalculate).toHaveBeenLastCalledWith(0);
  });

  it('rejects a negative top-up without requesting a recalculation', () => {
    const { onRecalculate } = renderModal();
    const input = screen.getByLabelText(/Top-up cash/i);

    fireEvent.change(input, { target: { value: '-1' } });
    act(() => { vi.advanceTimersByTime(500); });

    expect(onRecalculate).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a non-negative amount.')).toBeInTheDocument();
  });

  it('disables order creation while a recalculation is in flight', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('button', { name: /Create 2 Orders/i })).toBeDisabled();
  });

  it('shows a calculation error instead of the already-balanced copy', () => {
    renderModal({ recommendations: [], error: 'Weighted sell exceeds holding value' });
    expect(screen.getByRole('alert')).toHaveTextContent('Weighted sell exceeds holding value');
    expect(screen.queryByText(/already balanced/i)).toBeNull();
  });
});
