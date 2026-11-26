import { describe, it, expect } from 'vitest';
import { computeGroupSplit, parseTopUpAmount } from './mfWeights';

const holding = (
  holding_id: number,
  asset: string,
  qty: number,
  current_price: number,
  rebalance_weight: number | null,
) => ({ holding_id, asset, qty, current_price, rebalance_weight });

describe('computeGroupSplit', () => {
  it('normalizes positive weights within the group', () => {
    const split = computeGroupSplit([
      holding(1, 'SCBS&P500E', 10, 10, 100),
      holding(2, 'SCBS&P500A', 50, 10, 0),
      holding(3, 'SCBS&P500-SSF', 90, 10, null),
    ]);
    expect(split.mode).toBe('configured');
    expect(split.shares.map(s => s.pct)).toEqual([100, 0, 0]);
  });

  it('normalizes mixed positive, null and zero weights as shares of drift', () => {
    const split = computeGroupSplit([
      holding(1, 'A', 1000, 10, 1),
      holding(2, 'B', 10, 10, 3),
      holding(3, 'C', 10, 10, null),
    ]);
    expect(split.mode).toBe('configured');
    expect(split.shares[0].pct).toBeCloseTo(25, 8);
    expect(split.shares[1].pct).toBeCloseTo(75, 8);
    expect(split.shares[2].pct).toBe(0);
  });

  it('ignores negative weights and falls back when no positive weight exists', () => {
    const split = computeGroupSplit([
      holding(1, 'A', 100, 10, -5),
      holding(2, 'B', 300, 10, 0),
    ]);
    expect(split.mode).toBe('market');
    expect(split.shares.map(s => s.pct)).toEqual([25, 75]);
  });

  it('uses market value when every weight is null', () => {
    const split = computeGroupSplit([
      holding(1, 'A', 100, 10, null),
      holding(2, 'B', 300, 10, null),
    ]);
    expect(split.mode).toBe('market');
    expect(split.shares[0].pct).toBeCloseTo(25, 8);
    expect(split.shares[1].pct).toBeCloseTo(75, 8);
  });

  it('uses market value when every weight is zero', () => {
    const split = computeGroupSplit([
      holding(1, 'A', 1, 100, 0),
      holding(2, 'B', 1, 100, 0),
    ]);
    expect(split.mode).toBe('market');
    expect(split.shares.map(s => s.pct)).toEqual([50, 50]);
  });

  it('reports zero shares for a zero-value group without weights', () => {
    const split = computeGroupSplit([
      holding(1, 'A', 0, 0, null),
      holding(2, 'B', 0, 10, null),
    ]);
    expect(split.mode).toBe('market');
    expect(split.shares.map(s => s.pct)).toEqual([0, 0]);
  });

  it('carries each holding id so same-symbol holdings stay distinct', () => {
    const split = computeGroupSplit([
      holding(11, 'SCB', 100, 10, 1),
      holding(12, 'SCB', 300, 10, 3),
    ]);
    expect(split.shares.map(s => s.symbol)).toEqual(['SCB', 'SCB']);
    expect(split.shares.map(s => s.holding_id)).toEqual([11, 12]);
  });
});

describe('parseTopUpAmount', () => {
  it('accepts zero and positive finite amounts', () => {
    expect(parseTopUpAmount('0')).toBe(0);
    expect(parseTopUpAmount('10000.50')).toBe(10000.5);
  });

  it('rejects blank, negative and non-finite input', () => {
    expect(parseTopUpAmount('')).toBeNull();
    expect(parseTopUpAmount('   ')).toBeNull();
    expect(parseTopUpAmount('-1')).toBeNull();
    expect(parseTopUpAmount('NaN')).toBeNull();
    expect(parseTopUpAmount('Infinity')).toBeNull();
  });
});
