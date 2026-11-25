import React from 'react';
import type { AssetProduct } from '../../types';
import type { BrokerRecord } from '../../lib/api';
import { Field, SelectInput } from './Field';
import { CONTROL_HELPER } from './controlStyles';

/** Asset types a product identity can declare, shared by both asset modals. */
export const ASSET_TYPES = ['stock', 'future', 'option', 'crypto'];

/** The three identity dimensions that together pick one product. */
export interface ProductSelection {
  /** Product ticker, or `''` for a product without an underlying. */
  underlying: string;
  /** Broker id as a string, or `''` for Unassigned. */
  broker: string;
  /** Asset type, or `''` when the product has no default type. */
  type: string;
}

/** Shown when the three dropdowns resolve to no product. */
export const NO_MATCHING_PRODUCT =
  'No product matches Underlying + Broker + Type — create it with + New product.';

/** Seed the dropdowns from a product, NULL-aware. */
export const selectionForProduct = (product: AssetProduct | null | undefined): ProductSelection => ({
  underlying: product?.ticker ?? '',
  broker: product?.broker_id != null ? String(product.broker_id) : '',
  type: product?.asset_type ?? '',
});

/**
 * The exact product for an Underlying + Broker + Type combination.
 *
 * A blank value means NULL on that dimension (`— (none)` / `Unassigned` / `—`).
 */
export const resolveProduct = (
  products: AssetProduct[],
  selection: ProductSelection,
): AssetProduct | undefined => {
  const ticker = selection.underlying === '' ? null : selection.underlying;
  const brokerId = selection.broker === '' ? null : Number(selection.broker);
  const assetType = selection.type === '' ? null : selection.type;
  return products.find(product =>
    (product.ticker ?? null) === ticker
    && (product.broker_id ?? null) === brokerId
    && (product.asset_type ?? null) === assetType);
};

interface ProductSelectorProps {
  /** Prefix for the three control ids, unique per modal. */
  idPrefix: string;
  products: AssetProduct[];
  brokers: BrokerRecord[];
  selection: ProductSelection;
  onChange: (next: ProductSelection) => void;
  /** Grid class for the three columns (the caller owns the responsive scale). */
  className?: string;
}

/**
 * Picks the owning product for a symbol by its three identity dimensions, then
 * reads back the resolved product and the spec the product owns.
 */
const ProductSelector: React.FC<ProductSelectorProps> = ({
  idPrefix, products, brokers, selection, onChange, className,
}) => {
  const tickers = Array.from(new Set(
    products
      .map(product => product.ticker)
      .filter((ticker): ticker is string => ticker != null && ticker !== ''),
  )).sort((a, b) => a.localeCompare(b));

  const resolved = resolveProduct(products, selection);
  const resolvedSpec = resolved
    ? [
      `Multiplier ${resolved.multiplier != null && Number.isFinite(resolved.multiplier)
        ? String(Number(resolved.multiplier.toFixed(8)))
        : '—'}`,
      `Margin rate ${resolved.margin_rate != null && Number.isFinite(resolved.margin_rate)
        ? `${Number((resolved.margin_rate * 100).toFixed(2))}%`
        : '—'}`,
      `Mode ${resolved.margin_mode}`,
      `Source ${resolved.source}`,
    ].join(' · ')
    : '';
  const update = (patch: Partial<ProductSelection>) => onChange({ ...selection, ...patch });

  return (
    <>
      <div className={className}>
        <Field className="min-w-0" label="Underlying" htmlFor={`${idPrefix}-underlying`}
          hint="Products without an underlying appear as — (none).">
          <SelectInput id={`${idPrefix}-underlying`} value={selection.underlying}
            onChange={e => update({ underlying: e.target.value })}>
            <option value="">— (none)</option>
            {tickers.map(ticker => <option key={ticker} value={ticker}>{ticker}</option>)}
          </SelectInput>
        </Field>
        <Field className="min-w-0" label="Broker" htmlFor={`${idPrefix}-broker`}>
          <SelectInput id={`${idPrefix}-broker`} value={selection.broker}
            onChange={e => update({ broker: e.target.value })}>
            <option value="">Unassigned</option>
            {brokers.map(broker => <option key={broker.id} value={broker.id}>{broker.code}</option>)}
          </SelectInput>
        </Field>
        <Field className="min-w-0" label="Type" htmlFor={`${idPrefix}-type`}>
          <SelectInput id={`${idPrefix}-type`} value={selection.type}
            onChange={e => update({ type: e.target.value })}>
            <option value="">—</option>
            {ASSET_TYPES.map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <div aria-live="polite">
        {resolved ? (
          <>
            <p style={{ ...CONTROL_HELPER, margin: '4px 0 0', color: 'var(--color-ink)' }}>
              {`Product ${resolved.ticker ?? '—'} · ${resolved.broker_code ?? 'Unassigned'} · ${resolved.asset_type ?? '—'}`}
            </p>
            <p style={CONTROL_HELPER}>{resolvedSpec}</p>
          </>
        ) : (
          <p style={{ ...CONTROL_HELPER, color: 'var(--color-danger-text)' }}>
            {NO_MATCHING_PRODUCT}
          </p>
        )}
      </div>
    </>
  );
};

export default ProductSelector;
