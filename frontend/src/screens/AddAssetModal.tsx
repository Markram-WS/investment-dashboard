import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { BrokerRecord } from '../lib/api';
import type { AssetProduct } from '../types';
import ModalShell from './components/ModalShell';
import BrokerCombobox from './components/BrokerCombobox';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, NumberInput, SelectInput, TextInput } from './components/Field';
import { CONTROL_HELPER, CONTROL_TITLE } from './components/controlStyles';
import { apiErrorDetail } from './components/apiError';
import ProductSelector, {
  ASSET_TYPES,
  NO_MATCHING_PRODUCT,
  resolveProduct,
  selectionForProduct,
} from './components/ProductSelector';
import type { ProductSelection } from './components/ProductSelector';

export type AssetModalMode = 'product' | 'symbol';

interface AddAssetModalProps {
  open: boolean;
  mode: AssetModalMode;
  /** Owning product when `mode === 'symbol'`. */
  product?: AssetProduct | null;
  onClose: () => void;
  onSaved: () => void;
}

const SOURCES = ['manual', 'yfinance', 'tfex'];
const SOURCE_NONE = '-';
const MARGIN_MODES = ['notional', 'premium', 'span'];
const CREATION_SOURCES = ['yfinance', 'tfex', 'manual'];

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

const emptyProductForm = {
  ticker: '',
  asset_type: '',
  source: 'manual',
  broker_code: '',
  multiplier: '1',
  margin_rate: '0',
  margin_mode: 'notional',
  margin_per_contract: '',
};

const emptySymbolForm = {
  price_symbol: '',
  sync_symbol: '',
  option_type: '',
  expiry_date: '',
  strike_price: '',
};

const optionalNumber = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const AddAssetModal: React.FC<AddAssetModalProps> = ({
  open, mode, product, onClose, onSaved,
}) => {
  const [productForm, setProductForm] = useState({ ...emptyProductForm });
  const [symbolForm, setSymbolForm] = useState({ ...emptySymbolForm });
  const [selection, setSelection] = useState<ProductSelection>(selectionForProduct(product));
  const [products, setProducts] = useState<AssetProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [creationSource, setCreationSource] = useState('');
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newBrokerCurrency, setNewBrokerCurrency] = useState('THB');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.getBrokers()
      .then((rows) => { if (!cancelled) setBrokers(rows); })
      .catch(() => { /* the broker list is optional */ });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'symbol') return;
    let cancelled = false;
    api.getProducts()
      .then((rows) => {
        if (cancelled) return;
        setProducts(rows);
        setProductsLoaded(true);
        if (!product) setSelection(selectionForProduct(rows[0] ?? null));
      })
      .catch(() => { setProductsLoaded(true); /* the preselected product still resolves the dropdowns */ });
    return () => { cancelled = true; };
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setNewBrokerCurrency('THB');
    setSelection(selectionForProduct(product));
    setProducts(product ? [product] : []);
    setProductsLoaded(product != null);
    setCreationSource('');
    if (mode === 'product') {
      setProductForm({ ...emptyProductForm });
    } else {
      setSymbolForm({ ...emptySymbolForm });
    }
  }, [open, mode, product]);

  const editingSymbol = mode === 'symbol';
  const resolvedProduct = editingSymbol ? resolveProduct(products, selection) : undefined;
  const symbolUnresolved = editingSymbol && !resolvedProduct;
  const optionIdentity = resolvedProduct?.asset_type === 'option';
  const selectionIsBlank = !selection.underlying && !selection.broker && !selection.type;
  const canCreateIdentity = editingSymbol && productsLoaded && !resolvedProduct && !selectionIsBlank;
  const optionFieldsVisible = optionIdentity || selection.type === 'option';
  const creationReady = canCreateIdentity && creationSource !== '';
  const creationBroker = selection.broker
    ? brokers.find(broker => String(broker.id) === selection.broker)?.code ?? selection.broker
    : 'Unassigned';
  const creationCopy = `No product matches — this will create ${selection.underlying || '—'} · ${creationBroker} · ${selection.type || 'no type'}.`;

  useEffect(() => {
    if (!open || !editingSymbol || optionFieldsVisible) return;
    setSymbolForm(prev => (
      prev.option_type || prev.expiry_date || prev.strike_price
        ? { ...prev, option_type: '', expiry_date: '', strike_price: '' }
        : prev
    ));
  }, [open, editingSymbol, optionFieldsVisible]);

  if (!open) return null;

  const brokerCodeInput = productForm.broker_code.trim();
  const unassignedBroker = brokerCodeInput === ''
    || brokerCodeInput === '—'
    || brokerCodeInput === '— Unassigned —';
  const matchedBroker = unassignedBroker
    ? undefined
    : brokers.find(broker => broker.code.trim().toLowerCase() === brokerCodeInput.toLowerCase());
  const createBrokerCode = unassignedBroker || matchedBroker ? '' : brokerCodeInput;

  const handleSaveProduct = async () => {
    const ticker = productForm.ticker.trim();
    if (!ticker && unassignedBroker && !productForm.asset_type) {
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
    if (productForm.margin_mode === 'span' && productForm.margin_per_contract.trim()) {
      const marginPerContract = Number(productForm.margin_per_contract);
      if (!Number.isFinite(marginPerContract) || marginPerContract < 0) {
        setError('Margin per contract must be 0 or more');
        return;
      }
    }
    setLoading(true);
    setError('');
    let failedOnBroker = false;
    try {
      let brokerId = matchedBroker?.id ?? null;
      if (createBrokerCode) {
        failedOnBroker = true;
        const created = await api.createBroker({
          code: createBrokerCode,
          name: createBrokerCode,
          currency: newBrokerCurrency,
        });
        setBrokers(prev => (
          prev.some(broker => broker.id === created.id)
            ? prev
            : [...prev, created].sort((a, b) => a.code.localeCompare(b.code))
        ));
        brokerId = created.id;
        failedOnBroker = false;
      }
      await api.createProduct({
        ticker: ticker || undefined,
        broker_id: brokerId,
        asset_type: productForm.asset_type || null,
        multiplier,
        margin_rate: marginRate,
        margin_mode: productForm.margin_mode,
        source: productForm.source,
        ...(productForm.margin_mode === 'span'
          ? { margin_per_contract: optionalNumber(productForm.margin_per_contract) }
          : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to create the product', e);
      const message = apiErrorDetail(e, failedOnBroker
        ? "Couldn't create the broker. Try again."
        : "Couldn't create the product. Try again.");
      setError(message);
      const status = (e as { status?: number } | null)?.status;
      if (failedOnBroker && (status === 409 || /already exists/i.test(message))) {
        try {
          const rows = await api.getBrokers();
          setBrokers(rows);
        } catch {
          /* the existing-broker adoption needs the refreshed list; keep the inline error */
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSymbol = async () => {
    const syncSymbol = symbolForm.sync_symbol.trim();
    if (!syncSymbol) { setError('sync_symbol is required'); return; }
    if (!resolvedProduct && !canCreateIdentity) { setError(NO_MATCHING_PRODUCT); return; }
    if (!resolvedProduct && !creationSource) { setError('Price source is required'); return; }
    setLoading(true);
    setError('');
    let failedOnProduct = false;
    try {
      let owningProduct = resolvedProduct;
      if (!owningProduct) {
        failedOnProduct = true;
        const created = await api.createProduct({
          ticker: selection.underlying || null,
          broker_id: selection.broker ? Number(selection.broker) : null,
          asset_type: selection.type || null,
          source: creationSource,
          multiplier: 1,
          margin_rate: 0,
          margin_mode: 'notional',
        });
        setProducts(prev => (
          prev.some(product => product.product_id === created.product_id)
            ? prev
            : [...prev, created]
        ));
        owningProduct = created;
        failedOnProduct = false;
      }
      await api.createSymbol(owningProduct.product_id, {
        price_symbol: symbolForm.price_symbol.trim() || undefined,
        sync_symbol: syncSymbol,
        ...(owningProduct.asset_type === 'option' ? {
          option_type: symbolForm.option_type || null,
          expiry_date: symbolForm.expiry_date || null,
          strike_price: optionalNumber(symbolForm.strike_price),
        } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to create the symbol', e);
      setError(apiErrorDetail(e, failedOnProduct
        ? "Couldn't create the product. Try again."
        : "Couldn't create the symbol. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const title = editingSymbol ? 'New symbol' : 'Add product';

  return (
    <ModalShell open={open} onClose={onClose} title={title} zIndex={9999}>
      <div className={`${MODAL_CARD} ${modalPanel}`}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 12px' }}>
          {title}
        </h3>

        <div className={MODAL_BODY}>
          {error && <div style={errorText} className="text-[length:var(--fs-label)]">{error}</div>}

          {editingSymbol ? (
            <div className="space-y-2.5">
              <ProductSelector
                idPrefix="add-symbol"
                className={rowThree}
                products={products}
                brokers={brokers}
                selection={selection}
                onChange={setSelection}
                hideUnmatched={canCreateIdentity}
              />
              {canCreateIdentity && (
                <div className="rounded-xl border border-hairline p-2.5">
                  <p style={{ ...CONTROL_HELPER, color: 'var(--color-ink)' }}>{creationCopy}</p>
                  <Field className="min-w-0" label="Price source" htmlFor="add-symbol-creation-source" required>
                    <SelectInput id="add-symbol-creation-source" value={creationSource}
                      onChange={e => setCreationSource(e.target.value)}>
                      <option value="">Choose…</option>
                      {CREATION_SOURCES.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <p style={CONTROL_HELPER}>New products start at multiplier 1, margin 0%, mode notional.</p>
                </div>
              )}
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
              {optionFieldsVisible && (
                <div className={rowThree}>
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
                  <Field className="min-w-0" label="Strike price" htmlFor="add-symbol-strike">
                    <NumberInput id="add-symbol-strike" step="any" value={symbolForm.strike_price}
                      onChange={e => setSymbolForm(p => ({ ...p, strike_price: e.target.value }))} placeholder="—" />
                  </Field>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <Field className="min-w-0" label="Underlying" htmlFor="add-product-ticker"
                hint="Leave blank for no underlying — allowed only when a broker or a default type is set.">
                <TextInput id="add-product-ticker" value={productForm.ticker}
                  onChange={e => setProductForm(p => ({ ...p, ticker: e.target.value }))}
                  placeholder="e.g. S50, or leave blank for none" />
              </Field>
              <div className={rowTwo}>
                <Field className="min-w-0" label="Broker" htmlFor="add-product-broker"
                  hint="Pick an existing broker or type a new code to create it.">
                  <BrokerCombobox
                    id="add-product-broker"
                    value={productForm.broker_code}
                    onChange={brokerCode => setProductForm(p => ({ ...p, broker_code: brokerCode }))}
                    brokers={brokers}
                    createCode={createBrokerCode}
                    currency={newBrokerCurrency}
                    onCurrencyChange={setNewBrokerCurrency}
                    placeholder="DF, PI — or type a new code"
                  />
                </Field>
                <Field className="min-w-0" label="Type" htmlFor="add-product-type"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <SelectInput id="add-product-type" value={productForm.asset_type}
                    onChange={e => setProductForm(p => ({ ...p, asset_type: e.target.value }))}>
                    <option value="" data-muted="true">— No type —</option>
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className={rowThree}>
                <Field className="min-w-0" label="Multiplier" htmlFor="add-product-multiplier"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <NumberInput id="add-product-multiplier" step="any" value={productForm.multiplier}
                    onChange={e => setProductForm(p => ({ ...p, multiplier: e.target.value }))} placeholder="1" />
                </Field>
                <Field className="min-w-0" label="Margin rate" htmlFor="add-product-margin-rate"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <NumberInput id="add-product-margin-rate" step="any" value={productForm.margin_rate}
                    onChange={e => setProductForm(p => ({ ...p, margin_rate: e.target.value }))} placeholder="0" />
                </Field>
                <Field className="min-w-0" label="Margin mode" htmlFor="add-product-margin-mode"
                  hint="Inherited by every contract unless the contract overrides it.">
                  <SelectInput id="add-product-margin-mode" value={productForm.margin_mode}
                    onChange={e => setProductForm(p => ({ ...p, margin_mode: e.target.value }))}>
                    {MARGIN_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </SelectInput>
                </Field>
              </div>
              {productForm.margin_mode === 'span' && (
                <div className={rowTwo}>
                  <Field className="min-w-0" label="Margin per contract" htmlFor="add-product-margin-per-contract"
                    hint="Used by span mode: qty × this value.">
                    <NumberInput id="add-product-margin-per-contract" min={0} step="any"
                      value={productForm.margin_per_contract}
                      onChange={e => setProductForm(p => ({ ...p, margin_per_contract: e.target.value }))} />
                  </Field>
                </div>
              )}
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
            disabled={loading || (symbolUnresolved && !creationReady)} style={primaryButton}
            className="text-xs transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
            {loading
              ? 'Saving...'
              : canCreateIdentity
                ? 'Create product & apply'
                : (editingSymbol ? 'Create symbol' : 'Add product')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default AddAssetModal;
