/**
 * Managed Fund intra-group split display rule, mirrored from the backend:
 * positive weights are normalized within their underlying group; when every
 * weight is null/zero the group falls back to market-value proportion.
 */
export interface SplitHolding {
  holding_id: number;
  asset: string;
  qty: number;
  current_price: number;
  rebalance_weight: number | null;
}

export interface SplitShare {
  holding_id: number;
  symbol: string;
  /** Normalized share of the group, in percent. */
  pct: number;
}

export interface GroupSplit {
  mode: "configured" | "market";
  shares: SplitShare[];
}

export function computeGroupSplit(holdings: SplitHolding[]): GroupSplit {
  const weights = holdings.map(h =>
    h.rebalance_weight != null && Number.isFinite(h.rebalance_weight) && h.rebalance_weight > 0
      ? h.rebalance_weight
      : 0,
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight > 0) {
    return {
      mode: "configured",
      shares: holdings.map((h, i) => ({
        holding_id: h.holding_id,
        symbol: h.asset,
        pct: (weights[i] / totalWeight) * 100,
      })),
    };
  }

  const values = holdings.map(h => {
    const qty = Number.isFinite(h.qty) ? h.qty : 0;
    const price = Number.isFinite(h.current_price) ? h.current_price : 0;
    return Math.max(0, qty * price);
  });
  const totalValue = values.reduce((sum, v) => sum + v, 0);

  return {
    mode: "market",
    shares: holdings.map((h, i) => ({
      holding_id: h.holding_id,
      symbol: h.asset,
      pct: totalValue > 0 ? (values[i] / totalValue) * 100 : 0,
    })),
  };
}

/** Parse a top-up input; blank, negative, or non-finite values are invalid. */
export function parseTopUpAmount(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
