import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { BrokerRecord } from '../lib/api';
import type { AssetProduct } from '../types';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, NumberInput, SelectInput, TextInput } from './components/Field';
import { CONTROL_HELPER, CONTROL_TITLE } from './components/controlStyles';
import { apiErrorDetail } from './components/apiError';

export type AssetModalMode = 'product' | 'symbol';

interface AddAssetModalProps {
  open: boolean;
  mode: AssetModalMode;
  /** Owning product when `mode === 'symbol'`. */
  product?: AssetProduct | null;
  onClose: () => void;
  onSaved: () => void;
  groups: { id: number; name: string }[];
}

const SOURCES = ['manual', 'yfinance', 'tfex'];
const SOURCE_NONE = '-';
const TYPES = ['stock', 'future', 'option', 'crypto'];
const MARGIN_MODES = ['notional', 'premium', 'span'];
const CONTRACT_KINDS = ['future', 'stock', 'option', 'crypto'];

const primaryButton = {
  padding: '5px 12px',
  fontWeight: 500,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  border: '1px solid var(--color-ink)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  padding: '5px 12px',
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const errorText = {
  color: 'var(--color-danger-text)',
  background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)',
  borderRadius: 8,
  padding: '6px 8px',
  marginBottom: 12,
} as const;

const modalPanel = 'bg-canvas border border-hairline rounded-xl p-4 w-full max-w-[560px]';

/** Two equal short columns; collapses to one as the card narrows. */
const rowTwo = 'grid gap-2.5 grid-cols-1 min-[420px]:grid-cols-2';
/** Three equal short columns; collapses to two (then one) as the card narrows. */
const rowThree = 'grid gap-2.5 grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3';

const emptyBrokerForm = {
  code: '',
  name: '',
  currency: 'THB',
};

const emptyProductForm = {
  ticker: '',
  name: '',
  asset_type: '',
  source: 'manual',
  group_id: '',
  broker_id: '',
  multiplier: '1',
  margin_rate: '0',
  margin_mode: 'notional',
};

const emptySymbolForm = {
  price_symbol: '',
  sync_symbol: '',
  contract_kind: 'future',
  option_type: '',
  expiry_date: '',
  strike_price: '',
  multiplier_override: '',
  margin_rate_override: '',
  margin_per_contract: '',
};

const optionalNumber = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const AddAssetModal: React.FC<AddAssetModalProps> = ({
  open, mode, product, onClose, onSaved, groups,
}) => {
  const [productForm, setProductForm] = useState({ ...emptyProductForm });
  const [symbolForm, setSymbolForm] = useState({ ...emptySymbolForm });
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brokerPanelOpen, setBrokerPanelOpen] = useState(false);
  const [brokerForm, setBrokerForm] = useState({ ...emptyBrokerForm });
  const [brokerSaving, setBrokerSaving] = useState(false);
  const [brokerError, setBrokerError] = useState('');
  const [brokerNote, setBrokerNote] = useState('');

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
    setBrokerPanelOpen(false);
    setBrokerForm({ ...emptyBrokerForm });
    setBrokerSaving(false);
    setBrokerError('');
    setBrokerNote('');
    if (mode === 'product') {
      setProductForm({ ...emptyProductForm });
    } else {
      setSymbolForm({ ...emptySymbolForm });
    }
  }, [open, mode]);

  if (!open) return null;

  const editingSymbol = mode === 'symbol';

  const inheritedMultiplier = product?.multiplier != null ? String(product.multiplier) : '1';
  const inheritedMargin = product?.margin_rate != null
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
      await api.createProduct({
        ticker: ticker || undefined,
        name: productForm.name.trim() || undefined,
        broker_id: productForm.broker_id ? Number(productForm.broker_id) : null,
        asset_type: productForm.asset_type || null,
        multiplier,
        margin_rate: marginRate,
        margin_mode: productForm.margin_mode,
        source: productForm.source,
        group_id: productForm.group_id ? Number(productForm.group_id) : null,
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to create the product', e);
      setError(apiErrorDetail(e, "Couldn't create the product. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBroker = async () => {
    const code = brokerForm.code.trim();
    const name = brokerForm.name.trim();
    if (!code) { setBrokerError('Broker code is required'); return; }
    if (!name) { setBrokerError('Broker name is required'); return; }
    setBrokerSaving(true);
    setBrokerError('');
    try {
      const created = await api.createBroker({
        code,
        name,
        currency: brokerForm.currency,
      });
      setBrokers(prev => (
        prev.some(b => b.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.code.localeCompare(b.code))
      ));
      setProductForm(p => ({ ...p, broker_id: String(created.id) }));
      setBrokerPanelOpen(false);
      setBrokerForm({ ...emptyBrokerForm });
      setBrokerNote(`Broker ${created.code} created`);
      api.getBrokers()
        .then(rows => setBrokers(rows))
        .catch(() => { /* the optimistic row already covers the select */ });
    } catch (e) {
      console.error('Failed to create the broker', e);
      setBrokerError(apiErrorDetail(e, "Couldn't create the broker. Try again."));
    } finally {
      setBrokerSaving(false);
    }
  };

  const handleSaveSymbol = async () => {
    if (!product) { setError('Choose a product first.'); return; }
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
    setLoading(true);
    setError('');
    try {
      await api.createSymbol(product.product_id, {
        price_symbol: symbolForm.price_symbol.trim() || undefined,
        sync_symbol: syncSymbol,
        contract_kind: symbolForm.contract_kind,
        option_type: symbolForm.option_type || null,
        expiry_date: symbolForm.expiry_date || null,
        strike_price: optionalNumber(symbolForm.strike_price),
        multiplier_override: multiplierOverride,
        margin_rate_override: marginRateOverride,
        margin_per_contract: optionalNumber(symbolForm.margin_per_contract),
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to create the symbol', e);
      setError(apiErrorDetail(e, "Couldn't create the symbol. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const title = editingSymbol ? 'Add symbol' : 'Add product';

  return (
    <ModalShell open={open} onClose={onClose} title={title} zIndex={9999}>
      <div className={`${MODAL_CARD} ${modalPanel}`}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 12px' }}>
          {editingSymbol
            ? `Add symbol to ${product?.ticker ?? 'product'}`
            : 'Add product'}
        </h3>

        <div className={MODAL_BODY}>
          {error && <div style={errorText} className="text-[length:var(--fs-label)]">{error}</div>}

          {editingSymbol ? (
            <div className="space-y-2.5">
              <p style={{ ...CONTROL_HELPER, margin: 0 }}>
                Product {product?.ticker ?? '—'} · broker {product?.broker_code ?? 'Unassigned'} ·
                source {product?.source ?? '—'}
              </p>
              <div>
                <div className={rowTwo}>
                  <Field className="min-w-0" label="Ticker" htmlFor="add-symbol-price-symbol">
                    <TextInput id="add-symbol-price-symbol" value={symbolForm.price_symbol}
                      onChange={e => setSymbolForm(p => ({ ...p, price_symbol: e.target.value }))}
                      placeholder="Dashboard / order symbol" />
                  </Field>
                  <Field className="min-w-0" label="Sync symbol" htmlFor="add-symbol-sync-symbol" required>
                    <TextInput id="add-symbol-sync-symbol" value={symbolForm.sync_symbol}
                      onChange={e => setSymbolForm(p => ({ ...p, sync_symbol: e.target.value }))}
                      placeholder="Provider symbol (e.g. PTT.BK)" />
                  </Field>
                </div>
                <p style={CONTROL_HELPER}>Sync symbol is the provider key used for quotes; price symbol is the dashboard contract key orders use.</p>
              </div>
              <div className={rowThree}>
                <Field className="min-w-0" label="Contract kind" htmlFor="add-symbol-contract-kind">
                  <SelectInput id="add-symbol-contract-kind" value={symbolForm.contract_kind}
                    onChange={e => setSymbolForm(p => ({ ...p, contract_kind: e.target.value }))}>
                    {CONTRACT_KINDS.map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
                  </SelectInput>
                </Field>
                <Field className="min-w-0" label="Option type" htmlFor="add-symbol-option-type">
                  <SelectInput id="add-symbol-option-type" value={symbolForm.option_type}
                    onChange={e => setSymbolForm(p => ({ ...p, option_type: e.target.value }))}>
                    <option value="">—</option>
                    <option value="Call">Call</option>
                    <option value="Put">Put</option>
                  </SelectInput>
                </Field>
                <Field className="min-w-0" label="Expiry date" htmlFor="add-symbol-expiry">
                  <TextInput id="add-symbol-expiry" type="date" value={symbolForm.expiry_date}
                    onChange={e => setSymbolForm(p => ({ ...p, expiry_date: e.target.value }))} />
                </Field>
              </div>
              <div>
                <p style={{ ...CONTROL_HELPER, margin: '0 0 4px' }}>This contract can override the underlying defaults.</p>
                <div className={rowThree}>
                  <Field className="min-w-0" label="Strike price" htmlFor="add-symbol-strike">
                    <NumberInput id="add-symbol-strike" step="any" value={symbolForm.strike_price}
                      onChange={e => setSymbolForm(p => ({ ...p, strike_price: e.target.value }))} placeholder="—" />
                  </Field>
                  <Field className="min-w-0" label="Multiplier (this contract)" htmlFor="add-symbol-multiplier"
                    hint={`Empty = inherit the underlying default (${inheritedMultiplier}).`}>
                    <NumberInput id="add-symbol-multiplier" step="any" value={symbolForm.multiplier_override}
                      onChange={e => setSymbolForm(p => ({ ...p, multiplier_override: e.target.value }))} placeholder="Underlying default" />
                  </Field>
                  <Field className="min-w-0" label="Margin rate (this contract)" htmlFor="add-symbol-margin-rate"
                    hint={`Empty = inherit the underlying default (${inheritedMargin}).`}>
                    <NumberInput id="add-symbol-margin-rate" step="any" value={symbolForm.margin_rate_override}
                      onChange={e => setSymbolForm(p => ({ ...p, margin_rate_override: e.target.value }))} placeholder="Underlying default" />
                  </Field>
                </div>
              </div>
              <Field className="min-w-0" label="Margin per contract (span)" htmlFor="add-symbol-margin-per-contract">
                <NumberInput id="add-symbol-margin-per-contract" step="any" value={symbolForm.margin_per_contract}
                  onChange={e => setSymbolForm(p => ({ ...p, margin_per_contract: e.target.value }))}
                  placeholder="Used by span margin mode" />
              </Field>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className={rowTwo}>
                <Field className="min-w-0" label="Underlying" htmlFor="add-product-ticker"
                  hint="Leave blank for no underlying — allowed only when a broker or a default type is set.">
                  <TextInput id="add-product-ticker" value={productForm.ticker}
                    onChange={e => setProductForm(p => ({ ...p, ticker: e.target.value }))}
                    placeholder="e.g. S50, or leave blank for none" />
                </Field>
                <Field className="min-w-0" label="Name" htmlFor="add-product-name">
                  <TextInput id="add-product-name" value={productForm.name}
                    onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Optional display name" />
                </Field>
              </div>
              <div className={rowThree}>
                <div className="min-w-0">
                  <Field className="min-w-0" label="Broker" htmlFor="add-product-broker">
                    <SelectInput id="add-product-broker" value={productForm.broker_id}
                      onChange={e => setProductForm(p => ({ ...p, broker_id: e.target.value }))}>
                      <option value="">Unassigned</option>
                      {brokers.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                    </SelectInput>
                  </Field>
                  {!brokerPanelOpen && (
                    <button type="button"
                      onClick={() => { setBrokerError(''); setBrokerPanelOpen(true); }}
                      style={secondaryButton}
                      className="mt-1.5 text-[length:var(--fs-label)]">
                      + New broker
                    </button>
                  )}
                </div>
                <Field className="min-w-0" label="Default type" htmlFor="add-product-type"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <SelectInput id="add-product-type" value={productForm.asset_type}
                    onChange={e => setProductForm(p => ({ ...p, asset_type: e.target.value }))}>
                    <option value="">—</option>
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </SelectInput>
                </Field>
                <Field className="min-w-0" label="Group" htmlFor="add-product-group">
                  <SelectInput id="add-product-group" value={productForm.group_id}
                    onChange={e => setProductForm(p => ({ ...p, group_id: e.target.value }))}>
                    <option value="">None</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </SelectInput>
                </Field>
              </div>
              {brokerPanelOpen && (
                <div className="min-w-0 rounded-xl border border-hairline p-2.5">
                  <div className={rowThree}>
                    <Field className="min-w-0" label="Broker code" htmlFor="new-broker-code"
                      required hint="e.g. DF, PI">
                      <TextInput id="new-broker-code" value={brokerForm.code} maxLength={8}
                        onChange={e => {
                          setBrokerError('');
                          setBrokerForm(p => ({
                            ...p,
                            code: e.target.value.replace(/[^A-Za-z]/g, ''),
                          }));
                        }}
                        placeholder="DF" />
                    </Field>
                    <Field className="min-w-0" label="Broker name" htmlFor="new-broker-name"
                      required hint="Display name, e.g. Phillip Securities">
                      <TextInput id="new-broker-name" value={brokerForm.name}
                        onChange={e => {
                          setBrokerError('');
                          setBrokerForm(p => ({ ...p, name: e.target.value }));
                        }}
                        placeholder="Phillip Securities" />
                    </Field>
                    <Field className="min-w-0" label="Currency" htmlFor="new-broker-currency"
                      hint="Used for display only">
                      <SelectInput id="new-broker-currency" value={brokerForm.currency}
                        onChange={e => {
                          setBrokerError('');
                          setBrokerForm(p => ({ ...p, currency: e.target.value }));
                        }}>
                        <option value="THB">THB</option>
                        <option value="USD">USD</option>
                      </SelectInput>
                    </Field>
                  </div>
                  <p style={CONTROL_HELPER}>
                    The broker becomes selectable for this product immediately after it is created.
                  </p>
                  <div aria-live="polite">
                    {brokerError && (
                      <div style={errorText} className="text-[length:var(--fs-label)]">
                        {brokerError}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end" style={{ gap: 8, marginTop: 8 }}>
                    <button type="button"
                      onClick={() => {
                        setBrokerPanelOpen(false);
                        setBrokerError('');
                        setBrokerForm({ ...emptyBrokerForm });
                      }}
                      style={secondaryButton}
                      className="text-[length:var(--fs-label)]">Cancel</button>
                    <button type="button" onClick={handleCreateBroker} disabled={brokerSaving}
                      style={primaryButton}
                      className="text-[length:var(--fs-label)] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                      {brokerSaving ? 'Creating…' : 'Create broker'}
                    </button>
                  </div>
                </div>
              )}
              <div aria-live="polite" role="status">
                {brokerNote && (
                  <p style={{ ...CONTROL_HELPER, margin: '4px 0 0' }}>{brokerNote}</p>
                )}
              </div>
              <div className={rowThree}>
                <Field className="min-w-0" label="Default multiplier" htmlFor="add-product-multiplier"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <NumberInput id="add-product-multiplier" step="any" value={productForm.multiplier}
                    onChange={e => setProductForm(p => ({ ...p, multiplier: e.target.value }))} placeholder="1" />
                </Field>
                <Field className="min-w-0" label="Default margin rate" htmlFor="add-product-margin-rate"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <NumberInput id="add-product-margin-rate" step="any" value={productForm.margin_rate}
                    onChange={e => setProductForm(p => ({ ...p, margin_rate: e.target.value }))} placeholder="0" />
                </Field>
                <Field className="min-w-0" label="Default margin mode" htmlFor="add-product-margin-mode"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <SelectInput id="add-product-margin-mode" value={productForm.margin_mode}
                    onChange={e => setProductForm(p => ({ ...p, margin_mode: e.target.value }))}>
                    {MARGIN_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className={rowTwo}>
                <Field className="min-w-0" label="Source" htmlFor="add-product-source">
                  <SelectInput id="add-product-source" value={productForm.source}
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

        <div className={`${MODAL_FOOTER} flex justify-end`} style={{ gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose} style={secondaryButton} className="text-xs">Cancel</button>
          <button type="button" onClick={editingSymbol ? handleSaveSymbol : handleSaveProduct}
            disabled={loading} style={primaryButton}
            className="text-xs transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Saving...' : editingSymbol ? 'Add symbol' : 'Add product'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default AddAssetModal;
