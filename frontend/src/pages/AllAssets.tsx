import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AssetProduct, AssetSymbol } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import PageLayout from '../components/PageLayout';
import IconButton from '../components/IconButton';
import AddAssetModal from '../screens/AddAssetModal';
import EditAssetModal from '../screens/EditAssetModal';
import SyncFromOrdersModal from '../screens/components/SyncFromOrdersModal';
import { apiErrorDetail } from '../screens/components/apiError';
import { CONTROL_INPUT } from '../screens/components/controlStyles';
import { formatMoney, formatPct } from '../utils/format';

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'stock', label: 'Stock' },
  { value: 'future', label: 'Future' },
  { value: 'option', label: 'Option' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
];

/** Sources the backend can fetch a quote for. */
const PRICE_SOURCES = ['yfinance', 'tfex'];

/** The app nav is 60px; the registry head sticks directly under it. */
const NAV_H = 60;

const headCell = { fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--color-slate)', whiteSpace: 'nowrap' } as const;

const headTh = {
  ...headCell,
  position: 'sticky',
  top: NAV_H,
  zIndex: 5,
  background: 'var(--color-canvas)',
  padding: '6px 12px',
  borderBottom: '1px solid var(--color-hairline)',
} as const;

const cell = {
  fontSize: 'var(--fs-label)',
  padding: '4px 12px',
  borderBottom: '1px solid var(--color-hairline)',
} as const;

const badgeStyle = {
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  color: 'var(--color-slate)',
  background: 'var(--color-surface-soft)',
  borderRadius: 'var(--rounded-full)',
  padding: '1px 8px',
  whiteSpace: 'nowrap',
} as const;

/** Displayed wherever a nullable ticker has no value. */
const NO_TICKER = '—';

/** Labeled data columns plus the unlabeled actions column and the trailing spacer. */
const COLUMN_COUNT = 6;

/** Fixed tracks; only the trailing spacer absorbs slack. */
const COLUMN_WIDTHS = {
  sync: 140,
  price: 112,
  change: 92,
  actions: 72,
} as const;
const PRODUCT_MIN_WIDTH = 240;
const TABLE_MIN_WIDTH = PRODUCT_MIN_WIDTH
  + COLUMN_WIDTHS.sync + COLUMN_WIDTHS.price + COLUMN_WIDTHS.change + COLUMN_WIDTHS.actions;

/** Two-level registry: the product band then its symbols, one table per broker. */
const registryTable = {
  tableLayout: 'fixed',
  width: '100%',
  minWidth: TABLE_MIN_WIDTH,
  borderCollapse: 'separate',
  borderSpacing: 0,
} as const;

/** Effective multiplier for a product identity. */
const formatMultiplier = (value: number) =>
  Number.isFinite(value) ? String(Number(value.toFixed(8))) : '—';

/** Effective margin rate as a percentage, e.g. 0.10 → 10%. */
const formatMarginPct = (rate: number) =>
  Number.isFinite(rate) ? `${Number((rate * 100).toFixed(2))}%` : '—';

/** Products sort by underlying ticker first, then type. */
const ASSET_TYPE_RANK: Record<string, number> = {
  stock: 0,
  future: 1,
  option: 2,
  crypto: 3,
  mutual_fund: 4,
};
const UNKNOWN_TYPE_RANK = 5;
const NULL_TYPE_RANK = 6;

const typeRank = (type: string | null) =>
  type == null ? NULL_TYPE_RANK : ASSET_TYPE_RANK[type] ?? UNKNOWN_TYPE_RANK;

/** Underlying tickers ascend; a NULL underlying is always last. */
const compareUnderlyings = (a: string | null, b: string | null) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
};

/** Column head shared by every broker table. */
function RegistryHead() {
  return (
    <thead>
      <tr>
        <th className="at-assets-name-col" style={headTh} title="Product: underlying and type, then its symbols">Product · type / symbol</th>
        <th style={{ ...headTh, width: COLUMN_WIDTHS.sync }}>Sync symbol</th>
        <th className="text-right" style={{ ...headTh, width: COLUMN_WIDTHS.price, textAlign: 'right' }}>Price</th>
        <th className="text-right" style={{ ...headTh, width: COLUMN_WIDTHS.change, textAlign: 'right' }}>Change</th>
        <th aria-hidden="true" style={headTh} />
        <th style={{ ...headTh, width: COLUMN_WIDTHS.actions, paddingInline: 8 }}>
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}

function Chevron({ open, size }: { open: boolean; size: number }) {
  return (
    <svg className="transition-transform" style={{ width: size, height: size, flexShrink: 0, color: 'var(--color-slate)', transform: open ? 'none' : 'rotate(-90deg)' }}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const rowToggle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'inherit',
  fontFamily: 'inherit',
} as const;

const actionSlot = {
  width: 20,
  height: 20,
  flex: '0 0 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** The product band carries the identity; the actions cell is its own un-tinted track. */
const productCell = { ...cell, background: 'var(--color-surface)' } as const;

/** One product identity band plus its symbol rows, all in the broker's tbody. */
function ProductBlock({
  product, onEdit, onAddSymbol, onEditSymbol, onRefreshSymbol, onSaveQuote,
}: {
  product: AssetProduct;
  onEdit: (product: AssetProduct) => void;
  onAddSymbol: (product: AssetProduct) => void;
  onEditSymbol: (product: AssetProduct, symbol: AssetSymbol) => void;
  onRefreshSymbol: (product: AssetProduct, symbol: AssetSymbol) => Promise<void>;
  onSaveQuote: (symbol: AssetSymbol, price: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const underlyingLabel = product.ticker ?? NO_TICKER;
  const typeLabel = product.asset_type ?? NO_TICKER;
  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ['asset-symbols', product.product_id],
    queryFn: () => api.getSymbols({ product_id: product.product_id }),
    enabled: expanded,
  });
  const orderedSymbols = useMemo(
    () => symbols
      .slice()
      .sort((a, b) => (a.price_symbol ?? '').localeCompare(b.price_symbol ?? '')),
    [symbols],
  );

  return (
    <>
      <tr data-level="product" data-product-id={product.product_id} style={{ height: 32 }}>
        <td style={{ ...productCell, padding: 0 }}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${underlyingLabel} ${typeLabel}` : `Expand ${underlyingLabel} ${typeLabel}`}
            onClick={() => setExpanded(value => !value)}
            style={{ ...rowToggle, padding: '4px 12px' }}
          >
            <span style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-ink)' }}>
              {underlyingLabel}
            </span>
            <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 500, color: 'var(--color-slate)' }}>
              {typeLabel}
            </span>
          </button>
        </td>
        <td style={productCell} />
        <td className="text-right" style={{
          ...productCell,
          textAlign: 'right',
          whiteSpace: 'nowrap',
          color: 'var(--color-slate)',
          fontSize: 'var(--fs-micro)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatMultiplier(product.multiplier)} · {formatMarginPct(product.margin_rate)} · {product.margin_mode} · {product.source}
        </td>
        <td style={productCell} />
        <td style={productCell} />
        <td style={{ ...productCell, paddingInline: 8 }}>
          <div className="flex items-center justify-end" style={{ gap: 4 }}>
            <span style={actionSlot}>
              <IconButton label="Edit product" onClick={() => onEdit(product)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </IconButton>
            </span>
            <span style={actionSlot}>
              <IconButton label="+ New symbol" onClick={() => onAddSymbol(product)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </IconButton>
            </span>
          </div>
        </td>
      </tr>
      {expanded && (isLoading ? (
        <tr data-level="symbol-status">
          <td colSpan={COLUMN_COUNT} style={{ ...cell, paddingLeft: 22, color: 'var(--color-slate)' }}>Loading symbols…</td>
        </tr>
      ) : orderedSymbols.length === 0 ? (
        <tr data-level="symbol-status" title="Orders cannot resolve a contract spec for this product.">
          <td colSpan={COLUMN_COUNT} style={{ ...cell, paddingLeft: 22, color: 'var(--color-slate)' }}>
            No symbols
          </td>
        </tr>
      ) : orderedSymbols.map(symbol => (
        <SymbolRow
          key={symbol.symbol_id}
          product={product}
          symbol={symbol}
          onEditSymbol={onEditSymbol}
          onRefreshSymbol={onRefreshSymbol}
          onSaveQuote={onSaveQuote}
        />
      )))}
    </>
  );
}

/** One symbol under its product band: price symbol, sync symbol, quote and change. */
function SymbolRow({
  product, symbol, onEditSymbol, onRefreshSymbol, onSaveQuote,
}: {
  product: AssetProduct;
  symbol: AssetSymbol;
  onEditSymbol: (product: AssetProduct, symbol: AssetSymbol) => void;
  onRefreshSymbol: (product: AssetProduct, symbol: AssetSymbol) => Promise<void>;
  onSaveQuote: (symbol: AssetSymbol, price: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [priceVal, setPriceVal] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const feedBacked = PRICE_SOURCES.includes(product.source);

  const startEdit = () => {
    setPriceVal(symbol.price != null ? String(symbol.price) : '');
    setEditing(true);
  };

  const commitEdit = async () => {
    setEditing(false);
    const num = Number(priceVal);
    if (!priceVal.trim() || !Number.isFinite(num) || num < 0) return;
    await onSaveQuote(symbol, num);
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await onRefreshSymbol(product, symbol);
    setRefreshing(false);
  };

  return (
    <tr data-level="symbol" data-symbol-id={symbol.symbol_id} data-product-id={product.product_id}
      className="transition-colors hover:bg-surface" style={{ height: 28 }}>
      <td
        style={{ ...cell, paddingLeft: 22 }}
        title={symbol.price == null && !feedBacked ? 'No quote — this product has no price feed.' : undefined}
      >
        <span style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-ink)' }}>{symbol.price_symbol ?? NO_TICKER}</span>
        {symbol.price == null && feedBacked && (
          <span style={{ marginLeft: 6, color: 'var(--color-slate)', fontWeight: 400 }}>has no price</span>
        )}
      </td>
      <td style={{ ...cell, color: 'var(--color-slate)' }}>{symbol.sync_symbol}</td>
      <td className="text-right" style={{ ...cell, textAlign: 'right', cursor: 'pointer', fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)' }}
        onClick={startEdit} title="Edit the manual quote">
        {editing ? (
          <input type="number" step="any" value={priceVal} autoFocus
            onChange={e => setPriceVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="text-right"
            style={{ ...CONTROL_INPUT, width: 84 }}
            onClick={e => e.stopPropagation()} />
        ) : symbol.price != null ? (
          formatMoney(Number(symbol.price), 'USD')
        ) : '—'}
      </td>
      <td className="text-right" style={{
        ...cell,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 500,
        color: symbol.change_24h != null
          ? (symbol.change_24h >= 0 ? 'var(--color-positive-text)' : 'var(--color-danger-text)')
          : 'var(--color-slate)',
      }}>
        {symbol.change_24h != null ? formatPct(symbol.change_24h) : '—'}
      </td>
      <td style={cell} />
      <td style={{ ...cell, paddingInline: 8 }}>
        <div className="flex items-center justify-end" style={{ gap: 4 }}>
          <span style={actionSlot}>
            <IconButton label="Edit symbol" onClick={() => onEditSymbol(product, symbol)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </IconButton>
          </span>
          <span style={actionSlot}>
            {feedBacked && (
              <IconButton label={`Refresh ${symbol.sync_symbol}`} onClick={refresh} disabled={refreshing}>
                <svg className={refreshing ? 'animate-spin' : ''} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </IconButton>
            )}
          </span>
        </div>
      </td>
    </tr>
  );
}

interface BrokerSectionModel {
  key: string;
  label: string;
  products: AssetProduct[];
}

/** One collapsible table per broker, headed by the code and its product count. */
function BrokerSection({ sectionLabel, products, first, onEdit, onAddSymbol, onEditSymbol, onRefreshSymbol, onSaveQuote }: {
  sectionLabel: string;
  products: AssetProduct[];
  first: boolean;
  onEdit: (product: AssetProduct) => void;
  onAddSymbol: (product: AssetProduct) => void;
  onEditSymbol: (product: AssetProduct, symbol: AssetSymbol) => void;
  onRefreshSymbol: (product: AssetProduct, symbol: AssetSymbol) => Promise<void>;
  onSaveQuote: (symbol: AssetSymbol, price: number) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const orderedProducts = useMemo(
    () => products
      .slice()
      .sort((a, b) => (
        compareUnderlyings(a.ticker, b.ticker)
        || typeRank(a.asset_type) - typeRank(b.asset_type)
        || a.product_id - b.product_id
      )),
    [products],
  );

  return (
    <div style={{ marginTop: first ? 0 : 16 }}>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${sectionLabel}` : `Collapse ${sectionLabel}`}
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center select-none"
        style={{
          gap: 6,
          padding: '6px 12px 2px',
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Chevron open={!collapsed} size={12} />
        <span style={{
          fontSize: 'var(--fs-label)',
          fontWeight: 600,
          color: 'var(--color-ink)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {sectionLabel} · {products.length}
        </span>
      </button>
      <div className="max-[720px]:overflow-x-auto">
        <table className="w-full text-left" style={registryTable}>
          <RegistryHead />
          <tbody>
            {!collapsed && orderedProducts.map(product => (
              <ProductBlock
                key={product.product_id}
                product={product}
                onEdit={onEdit}
                onAddSymbol={onAddSymbol}
                onEditSymbol={onEditSymbol}
                onRefreshSymbol={onRefreshSymbol}
                onSaveQuote={onSaveQuote}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AllAssets() {
  const [typeFilter, setTypeFilter] = useState('');
  const [refreshMode, setRefreshMode] = useState<'manual' | 'auto'>(() => {
    return (localStorage.getItem('asset_refresh_mode') as 'manual' | 'auto') || 'manual';
  });
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [editProduct, setEditProduct] = useState<AssetProduct | null>(null);
  const [addSymbolFor, setAddSymbolFor] = useState<AssetProduct | null>(null);
  const [symbolModalOpen, setSymbolModalOpen] = useState(false);
  const [editSymbol, setEditSymbol] = useState<{ product: AssetProduct; symbol: AssetSymbol } | null>(null);
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const autoTimerRef = useRef<number | null>(null);

  const openSymbolModal = (owner: AssetProduct | null) => {
    setAddSymbolFor(owner);
    setSymbolModalOpen(true);
  };

  const closeSymbolModal = () => {
    setAddSymbolFor(null);
    setSymbolModalOpen(false);
  };

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['asset-products', typeFilter],
    queryFn: () => api.getProducts({ asset_type: typeFilter || undefined }),
  });

  const invalidateRegistry = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['asset-products'] });
    await queryClient.invalidateQueries({ queryKey: ['asset-symbols'] });
  }, [queryClient]);

  const refetchAll = useCallback(async () => {
    try {
      const result = await api.batchUpdatePrices();
      await invalidateRegistry();
      if (result.updated > 0) {
        notify(`Updated ${result.updated} price${result.updated === 1 ? '' : 's'}`, 'success');
      } else {
        notify('No prices updated — all symbols may be rate limited', 'warning');
      }
    } catch (e) {
      console.error('Failed to refresh prices', e);
      notify(apiErrorDetail(e, "Couldn't refresh prices"), 'warning');
    }
  }, [invalidateRegistry, notify]);

  const handleRefreshSymbol = async (product: AssetProduct, symbol: AssetSymbol) => {
    try {
      const updated = await api.updateSymbolPrice(symbol.symbol_id);
      if (updated.price != null && updated.price > 0) {
        for (const value of [symbol.price_symbol, symbol.sync_symbol]) {
          if (value) localStorage.setItem(`cached_price_${value}`, String(updated.price));
        }
      }
      notify(`${symbol.price_symbol ?? symbol.sync_symbol} price updated`, 'success');
      await queryClient.invalidateQueries({ queryKey: ['asset-symbols', product.product_id] });
    } catch (e) {
      console.error(`Failed to refresh ${symbol.sync_symbol}`, e);
      notify(apiErrorDetail(e, `Couldn't refresh ${symbol.sync_symbol}`), 'warning');
    }
  };

  const handleSaveQuote = async (symbol: AssetSymbol, price: number) => {
    try {
      await api.updateSymbolQuote(symbol.symbol_id, { price });
      if (symbol.price_symbol) localStorage.setItem(`cached_price_${symbol.price_symbol}`, String(price));
      await queryClient.invalidateQueries({ queryKey: ['asset-symbols'] });
    } catch (e) {
      console.error(`Failed to save the price for ${symbol.sync_symbol}`, e);
      notify(apiErrorDetail(e, `Couldn't save the ${symbol.sync_symbol} price`), 'warning');
    }
  };

  useEffect(() => {
    localStorage.setItem('asset_refresh_mode', refreshMode);
    if (refreshMode === 'auto') {
      autoTimerRef.current = setInterval(refetchAll, 600000);
      return () => { clearInterval(autoTimerRef.current ?? undefined); };
    }
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, [refreshMode, refetchAll]);

  /** Sections follow the broker code; the unassigned bucket is always last. */
  const sections = useMemo(() => {
    const byBroker = new Map<string, BrokerSectionModel>();
    for (const product of products) {
      const key = product.broker_id != null ? `broker_${product.broker_id}` : 'unassigned';
      const label = product.broker_code ?? 'Unassigned';
      const existing = byBroker.get(key);
      if (existing) existing.products.push(product);
      else byBroker.set(key, { key, label, products: [product] });
    }
    const unassigned = byBroker.get('unassigned');
    const assigned = [...byBroker.values()]
      .filter(section => section.key !== 'unassigned')
      .sort((a, b) => a.label.localeCompare(b.label));
    return unassigned ? [...assigned, unassigned] : assigned;
  }, [products]);

  const totalSymbols = useMemo(
    () => products.reduce((sum, product) => sum + product.symbol_count, 0),
    [products],
  );

  const loading = productsLoading;
  const summary = [
    `${products.length} product${products.length === 1 ? '' : 's'}`,
    `${totalSymbols} symbol${totalSymbols === 1 ? '' : 's'}`,
  ].join(' · ');

  return (
    <PageLayout>
      <AddAssetModal
        open={showProductModal}
        mode="product"
        onClose={() => setShowProductModal(false)}
        onSaved={() => { void invalidateRegistry(); }}
      />
      <AddAssetModal
        open={symbolModalOpen}
        mode="symbol"
        product={addSymbolFor}
        onClose={closeSymbolModal}
        onSaved={() => { void invalidateRegistry(); }}
      />
      <EditAssetModal
        open={!!editProduct}
        mode="product"
        product={editProduct}
        onClose={() => setEditProduct(null)}
        onSaved={() => { void invalidateRegistry(); }}
      />
      <EditAssetModal
        open={!!editSymbol}
        mode="symbol"
        product={editSymbol?.product ?? null}
        symbol={editSymbol?.symbol ?? null}
        onClose={() => setEditSymbol(null)}
        onSaved={() => { void invalidateRegistry(); }}
      />
      <SyncFromOrdersModal
        open={showSync}
        onClose={() => setShowSync(false)}
        onApplied={() => { void invalidateRegistry(); queryClient.invalidateQueries({ queryKey: ['asset-sync-proposal'] }); }}
      />

      <header className="at-head">
        <h1 className="at-h1">Assets</h1>
        <span className="truncate" style={{ fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--color-slate)', whiteSpace: 'nowrap' }}>
          {summary}
        </span>
        <div className="at-head-meta flex-wrap" style={{ gap: 8 }}>
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--color-slate)' }}>Auto</span>
            <button
              onClick={() => setRefreshMode(prev => prev === 'manual' ? 'auto' : 'manual')}
              className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
              style={{ background: refreshMode === 'auto' ? 'var(--color-brand-teal)' : 'var(--color-hairline)' }}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-canvas transition-transform ${refreshMode === 'auto' ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <button onClick={refetchAll}
            className="w-6 h-6 rounded-full border border-hairline flex items-center justify-center text-slate hover:text-ink hover:bg-surface transition-all"
            title="Refresh all prices">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between" style={{ gap: 8, marginTop: 8, marginBottom: 10 }}>
        <div className="flex items-center overflow-x-auto" style={{ gap: 6, maxWidth: '100%', minWidth: 0 }}>
          {TYPE_TABS.map(tab => {
            const active = typeFilter === tab.value;
            return (
              <button key={tab.value} onClick={() => setTypeFilter(tab.value)} className="at-tab" aria-pressed={active}>
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center" style={{ gap: 6, marginLeft: 'auto' }}>
          <button type="button" className="at-znew" onClick={() => setShowSync(true)}>Sync from orders</button>
          <button type="button" className="at-znew" onClick={() => setShowProductModal(true)}>+ New product</button>
          <button type="button" className="at-znew" onClick={() => openSymbolModal(null)}>+ New symbol</button>
        </div>
      </div>

      <div className="at-card" style={{ overflow: 'clip' }}>
        {(loading || sections.length === 0) ? (
          <div className="max-[720px]:overflow-x-auto">
            <table className="w-full text-left" style={registryTable}>
              <RegistryHead />
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ height: 32 }} className="animate-pulse">
                      <td colSpan={COLUMN_COUNT} style={cell}>
                        <div style={{ height: 8, width: `${62 - i * 9}%`, borderRadius: 999, background: 'var(--color-hairline-soft)' }} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ height: 32 }}>
                    <td colSpan={COLUMN_COUNT} style={{ ...cell, color: 'var(--color-slate)' }}>No products</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          sections.map((section, index) => (
            <BrokerSection
              key={section.key}
              sectionLabel={section.label}
              products={section.products}
              first={index === 0}
              onEdit={setEditProduct}
              onAddSymbol={openSymbolModal}
              onEditSymbol={(product, symbol) => setEditSymbol({ product, symbol })}
              onRefreshSymbol={handleRefreshSymbol}
              onSaveQuote={handleSaveQuote}
            />
          ))
        )}
      </div>
    </PageLayout>
  );
}
