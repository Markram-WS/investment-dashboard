import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { BrokerRecord } from '../lib/api';
import type { AssetProduct, AssetSymbol } from '../types';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, NumberInput, SelectInput, TextInput } from './components/Field';
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_HELPER,
  CONTROL_TITLE,
} from './components/controlStyles';
import { apiErrorDetail } from './components/apiError';

export type AssetEditMode = 'product' | 'symbol';

interface EditAssetModalProps {
  open: boolean;
  mode: AssetEditMode;
  /** Edited product, or the owning product when `mode === 'symbol'`. */
  product: AssetProduct | null;
  /** Edited symbol when `mode === 'symbol'`. */
  symbol?: AssetSymbol | null;
  onClose: () => void;
  onSaved: () => void;
  groups: { id: number; name: string }[];
}

const SOURCES = ['manual', 'yfinance', 'tfex'];
const SOURCE_NONE = '-';
const TYPES = ['stock', 'future', 'option', 'crypto'];
const MARGIN_MODES = ['notional', 'premium', 'span'];
const CONTRACT_KINDS = ['future', 'stock', 'option', 'crypto'];

const contextLine = {
  ...CONTROL_HELPER,
  margin: '0 0 10px',
} as const;

const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;
const dangerButton = {
  ...CONTROL_BUTTON_SECONDARY,
  color: 'var(--color-danger-text)',
  borderColor: 'var(--color-danger-text)',
} as const;

const errorText = {
  color: 'var(--color-danger-text)',
  background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)',
  borderRadius: 8,
  padding: '6px 8px',
  marginBottom: 12,
} as const;

const warningText = {
  color: 'var(--color-warning-text)',
  background: 'color-mix(in srgb, var(--color-status-warning) 12%, transparent)',
  borderRadius: 8,
  padding: '6px 8px',
  marginBottom: 8,
} as const;

const actionButtonClass = 'transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
const modalPanel = 'bg-canvas border border-hairline w-full max-w-[560px]';
const modalPanelStyle = {
  padding: 'var(--space-md)',
  borderRadius: 'var(--rounded-xl)',
} as const;

const rowTwo = 'grid gap-2.5 grid-cols-1 min-[420px]:grid-cols-2';
const rowThree = 'grid gap-2.5 grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3';

const numberText = (value: number | null | undefined): string =>
  value == null ? '' : String(value);

const optionalNumber = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const EditAssetModal: React.FC<EditAssetModalProps> = ({
  open, mode, product, symbol, onClose, onSaved, groups,
}) => {
  const [productForm, setProductForm] = useState({
    ticker: '', name: '', asset_type: '', source: 'manual', group_id: '',
    broker_id: '', multiplier: '1', margin_rate: '0', margin_mode: 'notional',
  });
  const [symbolForm, setSymbolForm] = useState({
    price_symbol: '', sync_symbol: '', contract_kind: 'future', option_type: '',
    expiry_date: '', strike_price: '', multiplier_override: '',
    margin_rate_override: '', margin_per_contract: '',
  });
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteChange, setQuoteChange] = useState('');
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || mode !== 'product') return;
    let cancelled = false;
    api.getBrokers()
      .then((rows) => { if (!cancelled) setBrokers(rows); })
      .catch(() => { /* the broker list is optional */ });
    return () => { cancelled = true; };
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setQuotePrice('');
    setQuoteChange('');
    if (mode === 'product' && product) {
      setProductForm({
        ticker: product.ticker ?? '',
        name: product.name ?? '',
        asset_type: product.asset_type ?? '',
        source: product.source ?? 'manual',
        group_id: product.group_id != null ? String(product.group_id) : '',
        broker_id: product.broker_id != null ? String(product.broker_id) : '',
        multiplier: String(product.multiplier ?? 1),
        margin_rate: String(product.margin_rate ?? 0),
        margin_mode: product.margin_mode || 'notional',
      });
    } else if (mode === 'symbol' && symbol) {
      setSymbolForm({
        price_symbol: symbol.price_symbol ?? '',
        sync_symbol: symbol.sync_symbol,
        contract_kind: symbol.contract_kind || 'future',
        option_type: symbol.option_type ?? '',
        expiry_date: symbol.expiry_date ?? '',
        strike_price: numberText(symbol.strike_price),
        multiplier_override: numberText(symbol.multiplier_override),
        margin_rate_override: numberText(symbol.margin_rate_override),
        margin_per_contract: numberText(symbol.margin_per_contract),
      });
    }
  }, [open, mode, product, symbol]);

  if (!open || !product) return null;

  const editingSymbol = mode === 'symbol';
  if (editingSymbol && !symbol) return null;

  const inheritedMultiplier = product.multiplier != null ? String(product.multiplier) : '1';
  const inheritedMargin = product.margin_rate != null
    ? `${Number((product.margin_rate * 100).toFixed(2))}%`
    : '0%';

  const handleSaveProduct = async () => {
    const ticker = productForm.ticker.trim();
    if (!ticker && !productForm.broker_id && !productForm.asset_type) {
      setError('Ticker is required');
      return;
    }
    const multiplier = Number(productForm.multiplier);
    const marginRate = Number(productForm.margin_rate);
    if (!productForm.multiplier.trim() || !Number.isFinite(multiplier) || multiplier <= 0) {
      setError('Multiplier must be greater than 0');
      return;
    }
    if (!productForm.margin_rate.trim() || !Number.isFinite(marginRate) || marginRate < 0 || marginRate > 1) {
      setError('Margin rate must be between 0 and 1');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.updateProduct(product.product_id, {
        ticker,
        name: productForm.name.trim() || null,
        asset_type: productForm.asset_type || null,
        source: productForm.source,
        group_id: productForm.group_id ? Number(productForm.group_id) : null,
        broker_id: productForm.broker_id ? Number(productForm.broker_id) : null,
        multiplier,
        margin_rate: marginRate,
        margin_mode: productForm.margin_mode,
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to update the product', e);
      setError(apiErrorDetail(e, "Couldn't update the product."));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSymbol = async () => {
    if (!symbol) return;
    const syncSymbol = symbolForm.sync_symbol.trim();
    if (!syncSymbol) { setError('sync_symbol is required'); return; }
    const multiplierOverride = optionalNumber(symbolForm.multiplier_override);
    const marginRateOverride = optionalNumber(symbolForm.margin_rate_override);
    if (symbolForm.multiplier_override.trim() && (multiplierOverride == null || multiplierOverride <= 0)) {
      setError('multiplier must be greater than 0');
      return;
    }
    if (symbolForm.margin_rate_override.trim() && (marginRateOverride == null || marginRateOverride < 0 || marginRateOverride > 1)) {
      setError('margin_rate must be between 0 and 1');
      return;
    }
    const price = optionalNumber(quotePrice);
    const change = optionalNumber(quoteChange);
    if (quotePrice.trim() && price == null) { setError('Price must be a number'); return; }
    if (quoteChange.trim() && change == null) { setError('Change must be a number'); return; }
    setLoading(true);
    setError('');
    try {
      await api.updateSymbol(symbol.symbol_id, {
        price_symbol: symbolForm.price_symbol.trim() || null,
        sync_symbol: syncSymbol,
        contract_kind: symbolForm.contract_kind,
        option_type: symbolForm.option_type || null,
        expiry_date: symbolForm.expiry_date || null,
        strike_price: optionalNumber(symbolForm.strike_price),
        multiplier_override: multiplierOverride,
        margin_rate_override: marginRateOverride,
        margin_per_contract: optionalNumber(symbolForm.margin_per_contract),
      });
      if (quotePrice.trim() || quoteChange.trim()) {
        await api.updateSymbolQuote(symbol.symbol_id, {
          price,
          change_24h: change,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to update the symbol', e);
      setError(apiErrorDetail(e, "Couldn't update the symbol."));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    const label = editingSymbol ? symbol?.price_symbol || symbol?.sync_symbol : product.ticker;
    if (!window.confirm(`Delete ${label}?`)) return;
    setLoading(true);
    try {
      if (editingSymbol && symbol) {
        await api.deleteSymbol(symbol.symbol_id);
      } else {
        await api.deleteProduct(product.product_id);
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to delete the asset', e);
      setError(apiErrorDetail(e, editingSymbol ? "Couldn't delete the symbol." : "Couldn't delete the product."));
    } finally {
      setLoading(false);
    }
  };

  const title = editingSymbol
    ? `Edit symbol — ${symbol?.price_symbol || symbol?.sync_symbol || ''}`
    : `Edit product — ${product.ticker ?? ''}`;

  return (
    <ModalShell open={open} onClose={onClose} title={title} zIndex={9999}>
      <div className={`${MODAL_CARD} ${modalPanel}`} style={modalPanelStyle}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 12px' }}>
          {title}
        </h3>

        <div className={MODAL_BODY}>
          {error && <div style={errorText} className="text-[length:var(--fs-label)]">{error}</div>}

          <p style={contextLine}>
            {editingSymbol
              ? `Product ${product.ticker ?? '—'} · broker ${product.broker_code ?? 'Unassigned'} · source ${product.source}`
              : `Broker ${product.broker_code ?? 'Unassigned'} · ${product.symbol_count} symbol${product.symbol_count === 1 ? '' : 's'}`}
          </p>

          {editingSymbol ? (
            <div className="space-y-2.5">
              <div>
                <div className={rowTwo}>
                  <Field className="min-w-0" label="Ticker" htmlFor="edit-symbol-price-symbol">
                    <TextInput id="edit-symbol-price-symbol" value={symbolForm.price_symbol}
                      onChange={e => setSymbolForm(p => ({ ...p, price_symbol: e.target.value }))}
                      placeholder="Dashboard / order symbol" />
                  </Field>
                  <Field className="min-w-0" label="Sync symbol" htmlFor="edit-symbol-sync-symbol" required>
                    <TextInput id="edit-symbol-sync-symbol" value={symbolForm.sync_symbol}
                      onChange={e => setSymbolForm(p => ({ ...p, sync_symbol: e.target.value }))} />
                  </Field>
                </div>
                <p style={CONTROL_HELPER}>Sync symbol is the provider key used for quotes; price symbol is the dashboard contract key orders use.</p>
              </div>
              <div className={rowThree}>
                <Field className="min-w-0" label="Contract kind" htmlFor="edit-symbol-contract-kind">
                  <SelectInput id="edit-symbol-contract-kind" value={symbolForm.contract_kind}
                    onChange={e => setSymbolForm(p => ({ ...p, contract_kind: e.target.value }))}>
                    {CONTRACT_KINDS.map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
                  </SelectInput>
                </Field>
                <Field className="min-w-0" label="Option type" htmlFor="edit-symbol-option-type">
                  <SelectInput id="edit-symbol-option-type" value={symbolForm.option_type}
                    onChange={e => setSymbolForm(p => ({ ...p, option_type: e.target.value }))}>
                    <option value="">—</option>
                    <option value="Call">Call</option>
                    <option value="Put">Put</option>
                  </SelectInput>
                </Field>
                <Field className="min-w-0" label="Expiry date" htmlFor="edit-symbol-expiry">
                  <TextInput id="edit-symbol-expiry" type="date" value={symbolForm.expiry_date}
                    onChange={e => setSymbolForm(p => ({ ...p, expiry_date: e.target.value }))} />
                </Field>
              </div>
              <div>
                <p style={{ ...CONTROL_HELPER, margin: '0 0 4px' }}>This contract can override the underlying defaults.</p>
                <div className={rowThree}>
                  <Field className="min-w-0" label="Strike price" htmlFor="edit-symbol-strike">
                    <NumberInput id="edit-symbol-strike" step="any" value={symbolForm.strike_price}
                      onChange={e => setSymbolForm(p => ({ ...p, strike_price: e.target.value }))} placeholder="—" />
                  </Field>
                  <Field className="min-w-0" label="Multiplier (this contract)" htmlFor="edit-symbol-multiplier"
                    hint={`Empty = inherit the underlying default (${inheritedMultiplier}).`}>
                    <NumberInput id="edit-symbol-multiplier" step="any" value={symbolForm.multiplier_override}
                      onChange={e => setSymbolForm(p => ({ ...p, multiplier_override: e.target.value }))}
                      placeholder="Underlying default" />
                  </Field>
                  <Field className="min-w-0" label="Margin rate (this contract)" htmlFor="edit-symbol-margin-rate"
                    hint={`Empty = inherit the underlying default (${inheritedMargin}).`}>
                    <NumberInput id="edit-symbol-margin-rate" step="any" value={symbolForm.margin_rate_override}
                      onChange={e => setSymbolForm(p => ({ ...p, margin_rate_override: e.target.value }))}
                      placeholder="Underlying default" />
                  </Field>
                </div>
              </div>
              <Field className="min-w-0" label="Margin per contract (span)" htmlFor="edit-symbol-margin-per-contract">
                <NumberInput id="edit-symbol-margin-per-contract" step="any" value={symbolForm.margin_per_contract}
                  onChange={e => setSymbolForm(p => ({ ...p, margin_per_contract: e.target.value }))}
                  placeholder="Used by span margin mode" />
              </Field>
              <div>
                <div className={rowTwo}>
                  <Field className="min-w-0" label="Quote price (manual)" htmlFor="edit-symbol-quote-price">
                    <NumberInput id="edit-symbol-quote-price" step="any" value={quotePrice}
                      onChange={e => setQuotePrice(e.target.value)}
                      placeholder={symbol?.price != null ? String(symbol.price) : '—'} />
                  </Field>
                  <Field className="min-w-0" label="24h change" htmlFor="edit-symbol-quote-change">
                    <NumberInput id="edit-symbol-quote-change" step="any" value={quoteChange}
                      onChange={e => setQuoteChange(e.target.value)}
                      placeholder={symbol?.change_24h != null ? String(symbol.change_24h) : '—'} />
                  </Field>
                </div>
                <p style={CONTROL_HELPER}>Leave blank to keep the current quote.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className={rowTwo}>
                <Field className="min-w-0" label="Underlying" htmlFor="edit-product-ticker"
                  hint="Leave blank for no underlying — allowed only when a broker or a default type is set.">
                  <TextInput id="edit-product-ticker" value={productForm.ticker}
                    onChange={e => setProductForm(p => ({ ...p, ticker: e.target.value }))} />
                </Field>
                <Field className="min-w-0" label="Name" htmlFor="edit-product-name">
                  <TextInput id="edit-product-name" value={productForm.name}
                    onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Optional display name" />
                </Field>
              </div>
              <div className={rowThree}>
                <Field className="min-w-0" label="Broker" htmlFor="edit-product-broker">
                  <SelectInput id="edit-product-broker" value={productForm.broker_id}
                    onChange={e => setProductForm(p => ({ ...p, broker_id: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                  </SelectInput>
                </Field>
                <Field className="min-w-0" label="Default type" htmlFor="edit-product-type"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <SelectInput id="edit-product-type" value={productForm.asset_type}
                    onChange={e => setProductForm(p => ({ ...p, asset_type: e.target.value }))}>
                    <option value="">—</option>
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </SelectInput>
                </Field>
                <Field className="min-w-0" label="Group" htmlFor="edit-product-group">
                  <SelectInput id="edit-product-group" value={productForm.group_id}
                    onChange={e => setProductForm(p => ({ ...p, group_id: e.target.value }))}>
                    <option value="">None</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className={rowThree}>
                <Field className="min-w-0" label="Default multiplier" htmlFor="edit-product-multiplier"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <NumberInput id="edit-product-multiplier" step="any" value={productForm.multiplier}
                    onChange={e => setProductForm(p => ({ ...p, multiplier: e.target.value }))} placeholder="1" />
                </Field>
                <Field className="min-w-0" label="Default margin rate" htmlFor="edit-product-margin-rate"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <NumberInput id="edit-product-margin-rate" step="any" value={productForm.margin_rate}
                    onChange={e => setProductForm(p => ({ ...p, margin_rate: e.target.value }))} placeholder="0" />
                </Field>
                <Field className="min-w-0" label="Default margin mode" htmlFor="edit-product-margin-mode"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <SelectInput id="edit-product-margin-mode" value={productForm.margin_mode}
                    onChange={e => setProductForm(p => ({ ...p, margin_mode: e.target.value }))}>
                    {MARGIN_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className={rowTwo}>
                <Field className="min-w-0" label="Source" htmlFor="edit-product-source">
                  <SelectInput id="edit-product-source" value={productForm.source}
                    onChange={e => setProductForm(p => ({ ...p, source: e.target.value }))}>
                    <option value={SOURCE_NONE}>None</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <p style={CONTROL_HELPER}>Margin 0.10 = 10%; the multiplier applies to every symbol without an override.</p>
            </div>
          )}
        </div>

        {!editingSymbol && product.symbol_count > 0 &&
          (productForm.broker_id ? Number(productForm.broker_id) : null) !== product.broker_id && (
          <div style={warningText} className="text-[length:var(--fs-label)]" role="status">
            A product with attached symbols cannot change broker until its symbols are removed.
          </div>
        )}

        <div className={`${MODAL_FOOTER} flex justify-between items-center`} style={{ marginTop: 12 }}>
          <div>
            <button type="button" onClick={handleDelete} disabled={loading}
              className={actionButtonClass} style={dangerButton}>
              Delete
            </button>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
            <button type="button" onClick={editingSymbol ? handleSaveSymbol : handleSaveProduct}
              disabled={loading} className={actionButtonClass} style={primaryButton}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default EditAssetModal;
