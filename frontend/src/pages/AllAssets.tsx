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

const COL_SPEC = 'hidden md:table-cell';
const COL_SOURCE = 'hidden sm:table-cell';

/** Displayed wherever a nullable ticker has no value. */
const NO_TICKER = '—';

const COLUMN_COUNT = 8;

/** Effective multiplier for a contract: the symbol override or the product default. */
const formatMultiplier = (value: number) =>
  Number.isFinite(value) ? String(Number(value.toFixed(8))) : '—';

/** Effective margin rate as a percentage, e.g. 0.10 → 10%. */
const formatMarginPct = (rate: number) =>
  Number.isFinite(rate) ? `${Number((rate * 100).toFixed(2))}%` : '—';

/** Column head shared by every broker table. */
function RegistryHead() {
  return (
    <thead>
      <tr>
        <th style={{ ...headTh, width: '24%' }} title="Underlying: the product that owns these contracts">Underlying</th>
        <th className={COL_SPEC} style={{ ...headTh, width: '11%' }}>Type</th>
        <th className="text-right" style={{ ...headTh, width: '12%', textAlign: 'right' }} title="Default multiplier — inherited by every contract unless the contract overrides it">Multiplier</th>
        <th className="text-right" style={{ ...headTh, width: '11%', textAlign: 'right' }} title="Default margin rate, 0.10 = 10% — inherited by every contract unless the contract overrides it">Margin</th>
        <th className={COL_SPEC} style={{ ...headTh, width: '11%' }}>Mode</th>
        <th className={COL_SOURCE} style={{ ...headTh, width: '11%' }}>Source</th>
        <th className="text-right" style={{ ...headTh, width: '10%', textAlign: 'right' }}>Contracts</th>
        <th style={{ ...headTh, width: '10%', paddingInline: 8 }}>
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}

/** Fixed layout for a registry table, stacked inside the page card. */
const registryTable = { borderCollapse: 'separate', borderSpacing: 0 } as const;

function ProductRow({
  product, expanded, onToggle, onEdit, onAddSymbol, onEditSymbol, onRefreshSymbol, onSaveQuote,
}: {
  product: AssetProduct;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (product: AssetProduct) => void;
  onAddSymbol: (product: AssetProduct) => void;
  onEditSymbol: (product: AssetProduct, symbol: AssetSymbol) => void;
  onRefreshSymbol: (product: AssetProduct, symbol: AssetSymbol) => Promise<void>;
  onSaveQuote: (symbol: AssetSymbol, price: number) => Promise<void>;
}) {
  return (
    <>
      <tr className="transition-colors hover:bg-surface" style={{ height: 32 }}>
        <td style={cell} title={product.ticker ?? undefined}>
          <div className="flex items-center" style={{ gap: 6 }}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${product.ticker ?? NO_TICKER}` : `Expand ${product.ticker ?? NO_TICKER}`}
              onClick={onToggle}
              className="flex items-center justify-center"
              style={{ width: 14, height: 14, color: 'var(--color-slate)', padding: 0, border: 0, background: 'transparent' }}
            >
              <svg className="transition-transform" style={{ width: 12, height: 12, transform: expanded ? 'none' : 'rotate(-90deg)' }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className="truncate" style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.05 }}>
              {product.ticker ?? NO_TICKER}
              {product.name && product.name !== product.ticker && (
                <span style={{ fontWeight: 400, color: 'var(--color-slate)', marginLeft: 6 }}>{product.name}</span>
              )}
            </div>
          </div>
        </td>
        <td className={COL_SPEC} style={{ ...cell, color: 'var(--color-slate)' }}>
          {product.asset_type ?? '—'}
        </td>
        <td className="text-right" style={{ ...cell, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {product.multiplier != null && !Number.isNaN(Number(product.multiplier)) ? String(product.multiplier) : '—'}
        </td>
        <td className="text-right" style={{ ...cell, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}
          title="rate of notional, 0.10 = 10%">
          {product.margin_rate != null && !Number.isNaN(Number(product.margin_rate)) ? Number(product.margin_rate).toFixed(2) : '—'}
        </td>
        <td className={COL_SPEC} style={{ ...cell, color: 'var(--color-slate)', whiteSpace: 'nowrap' }}>
          {product.margin_mode}
        </td>
        <td className={COL_SOURCE} style={cell}>
          <span style={badgeStyle}>{product.source}</span>
        </td>
        <td className="text-right" style={{ ...cell, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {product.symbol_count}
        </td>
        <td style={{ ...cell, paddingInline: 8 }}>
          <div className="flex items-center justify-end" style={{ gap: 4 }}>
            <IconButton label="+ New symbol" onClick={() => onAddSymbol(product)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </IconButton>
            <IconButton label="Edit product" onClick={() => onEdit(product)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </IconButton>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={COLUMN_COUNT} style={{ padding: 0, borderBottom: '1px solid var(--color-hairline)', background: 'var(--color-surface)' }}>
            <SymbolRows
              product={product}
              onEditSymbol={onEditSymbol}
              onRefreshSymbol={onRefreshSymbol}
              onSaveQuote={onSaveQuote}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function SymbolRows({ product, onEditSymbol, onRefreshSymbol, onSaveQuote }: {
  product: AssetProduct;
  onEditSymbol: (product: AssetProduct, symbol: AssetSymbol) => void;
  onRefreshSymbol: (product: AssetProduct, symbol: AssetSymbol) => Promise<void>;
  onSaveQuote: (symbol: AssetSymbol, price: number) => Promise<void>;
}) {
  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ['asset-symbols', product.product_id],
    queryFn: () => api.getSymbols({ product_id: product.product_id }),
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [priceVal, setPriceVal] = useState('');
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const startEdit = (symbol: AssetSymbol) => {
    setPriceVal(symbol.price != null ? String(symbol.price) : '');
    setEditingId(symbol.symbol_id);
  };

  const commitEdit = async (symbol: AssetSymbol) => {
    setEditingId(null);
    const num = Number(priceVal);
    if (!priceVal.trim() || !Number.isFinite(num) || num < 0) return;
    await onSaveQuote(symbol, num);
  };

  const refresh = async (symbol: AssetSymbol) => {
    if (refreshingId != null) return;
    setRefreshingId(symbol.symbol_id);
    await onRefreshSymbol(product, symbol);
    setRefreshingId(null);
  };

  const subHead = {
    fontSize: 'var(--fs-micro)',
    fontWeight: 500,
    color: 'var(--color-slate)',
    padding: '4px 12px',
    whiteSpace: 'nowrap',
  } as const;

  return (
    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...subHead, paddingLeft: 32 }}>Price symbol</th>
          <th style={subHead}>Sync symbol</th>
          <th className={COL_SPEC} style={subHead}>Contract</th>
          <th className="text-right" style={{ ...subHead, textAlign: 'right' }}>Price</th>
          <th className="text-right" style={{ ...subHead, textAlign: 'right' }}>Change</th>
          <th className={COL_SPEC} style={subHead}>Updated</th>
          <th style={{ ...subHead, width: 44 }}><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr><td colSpan={7} style={{ ...cell, paddingLeft: 32, color: 'var(--color-slate)' }}>Loading symbols…</td></tr>
        ) : symbols.length === 0 ? (
          <tr><td colSpan={7} style={{ ...cell, paddingLeft: 32, color: 'var(--color-slate)' }}>
            No symbols — orders cannot resolve a contract spec for this product.
          </td></tr>
        ) : symbols.map((symbol) => {
          const optionBits = [
            symbol.option_type,
            symbol.expiry_date,
            symbol.strike_price != null ? `@${symbol.strike_price}` : null,
          ].filter(Boolean).join(' · ');
          const effectiveSpec = [
            'mult',
            formatMultiplier(symbol.multiplier_effective),
            formatMarginPct(symbol.margin_rate_effective),
          ].join(' · ')
            + (symbol.margin_per_contract != null ? ` · span ${symbol.margin_per_contract}` : '');
          return (
            <tr key={symbol.symbol_id} className="transition-colors hover:bg-surface" style={{ height: 30 }}>
              <td style={{ ...cell, paddingLeft: 32, color: 'var(--color-ink)', fontWeight: 500 }}>
                {symbol.price_symbol ?? '—'}
              </td>
              <td style={{ ...cell, color: 'var(--color-slate)' }}>{symbol.sync_symbol}</td>
              <td className={COL_SPEC} style={{ ...cell, color: 'var(--color-slate)' }}>
                <span>{symbol.contract_kind}{optionBits ? ` · ${optionBits}` : ''}</span>
                <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--color-slate)' }}
                  title="Effective values for this contract">
                  {effectiveSpec}
                </span>
              </td>
              <td className="text-right" style={{ ...cell, cursor: 'pointer', fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)' }}
                onClick={() => startEdit(symbol)} title="Edit the manual quote">
                {editingId === symbol.symbol_id ? (
                  <input type="number" step="any" value={priceVal} autoFocus
                    onChange={e => setPriceVal(e.target.value)}
                    onBlur={() => commitEdit(symbol)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(symbol);
                      if (e.key === 'Escape') setEditingId(null);
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
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500,
                color: symbol.change_24h != null
                  ? (symbol.change_24h >= 0 ? 'var(--color-positive-text)' : 'var(--color-danger-text)')
                  : 'var(--color-slate)',
              }}>
                {symbol.change_24h != null ? formatPct(symbol.change_24h) : '—'}
              </td>
              <td className={COL_SPEC} style={{ ...cell, color: 'var(--color-slate)', fontSize: 'var(--fs-micro)' }}>
                {symbol.updated_at ? symbol.updated_at.replace('T', ' ').slice(0, 19) : '—'}
              </td>
              <td style={{ ...cell, paddingInline: 8 }}>
                <div className="flex items-center justify-end" style={{ gap: 4 }}>
                  {PRICE_SOURCES.includes(product.source) && (
                    <IconButton label={`Refresh ${symbol.sync_symbol}`} onClick={() => refresh(symbol)} disabled={refreshingId != null}>
                      <svg className={refreshingId === symbol.symbol_id ? 'animate-spin' : ''} viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    </IconButton>
                  )}
                  <IconButton label="Edit symbol" onClick={() => onEditSymbol(product, symbol)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </IconButton>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface BrokerSectionModel {
  key: string;
  label: string;
  products: AssetProduct[];
}

/** One collapsible table per broker, headed by the code and its product count. */
function BrokerSection({ sectionLabel, products, first, expanded, onToggle, onEdit, onAddSymbol, onEditSymbol, onRefreshSymbol, onSaveQuote }: {
  sectionLabel: string;
  products: AssetProduct[];
  first: boolean;
  expanded: Set<number>;
  onToggle: (productId: number) => void;
  onEdit: (product: AssetProduct) => void;
  onAddSymbol: (product: AssetProduct) => void;
  onEditSymbol: (product: AssetProduct, symbol: AssetSymbol) => void;
  onRefreshSymbol: (product: AssetProduct, symbol: AssetSymbol) => Promise<void>;
  onSaveQuote: (symbol: AssetSymbol, price: number) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);

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
        <svg className="transition-transform" style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--color-slate)', transform: collapsed ? 'rotate(-90deg)' : 'none' }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span style={{
          fontSize: 'var(--fs-label)',
          fontWeight: 600,
          color: 'var(--color-ink)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {sectionLabel} · {products.length}
        </span>
      </button>
      <table className="w-full text-left" style={registryTable}>
        <RegistryHead />
        <tbody>
          {!collapsed && products.map((product) => (
            <ProductRow
              key={product.product_id}
              product={product}
              expanded={expanded.has(product.product_id)}
              onToggle={() => onToggle(product.product_id)}
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
  const [editSymbol, setEditSymbol] = useState<{ product: AssetProduct; symbol: AssetSymbol } | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const autoTimerRef = useRef<number | null>(null);

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

  const toggleExpanded = (productId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

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
        open={!!addSymbolFor}
        mode="symbol"
        product={addSymbolFor}
        onClose={() => setAddSymbolFor(null)}
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
        </div>
      </div>

      <div className="at-card" style={{ overflow: 'clip' }}>
        {(loading || sections.length === 0) ? (
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
        ) : (
          sections.map((section, index) => (
            <BrokerSection
              key={section.key}
              sectionLabel={section.label}
              products={section.products}
              first={index === 0}
              expanded={expanded}
              onToggle={toggleExpanded}
              onEdit={setEditProduct}
              onAddSymbol={setAddSymbolFor}
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
