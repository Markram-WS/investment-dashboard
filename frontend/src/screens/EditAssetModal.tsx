import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { AssetUpdatePayload } from '../lib/api';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, NumberInput, SelectInput, TextInput } from './components/Field';
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_HELPER,
  CONTROL_TITLE,
} from './components/controlStyles';

/** Editable asset shape read by this modal (callers may pass the raw row). */
interface EditableAsset {
  asset_id: number;
  ticker: string;
  price_symbol?: string | null;
  asset_type?: string | null;
  source?: string | null;
  group_id?: number | null;
  price?: number | null;
  multiplier?: number | null;
  margin_rate?: number | null;
  broker_code?: string | null;
  sync_protected?: boolean | null;
}

interface EditAssetModalProps {
  open: boolean;
  asset: EditableAsset | null;
  onClose: () => void;
  onSaved: () => void;
  groups: { id: number; name: string }[];
}

const SOURCES = ['manual', 'yfinance', 'tfex'];
const TYPES = ['stock', 'future', 'option', 'crypto'];

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

/** Two equal short columns; collapses to one as the card narrows. */
const rowTwo = 'grid gap-2.5 grid-cols-1 min-[420px]:grid-cols-2';
/** Three equal short columns; collapses to two (then one) as the card narrows. */
const rowThree = 'grid gap-2.5 grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3';

const EditAssetModal: React.FC<EditAssetModalProps> = ({ open, asset, onClose, onSaved, groups }) => {
  const [form, setForm] = useState({ ticker: '', price_symbol: '', asset_type: 'stock', source: 'manual', group_id: '', multiplier: '1', margin_rate: '0' });
  const [priceStr, setPriceStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (asset) {
      setForm({
        ticker: asset.ticker,
        price_symbol: asset.price_symbol ?? '',
        asset_type: asset.asset_type || 'stock',
        source: asset.source || 'manual',
        group_id: asset.group_id != null ? String(asset.group_id) : '',
        multiplier: String(asset.multiplier ?? 1),
        margin_rate: String(asset.margin_rate ?? 0),
      });
      setPriceStr(asset.price != null ? String(asset.price) : '');
    }
  }, [asset]);

  if (!open || !asset) return null;

  const handleSave = async () => {
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker) {
      setError('Ticker is required');
      return;
    }
    const multiplier = parseFloat(form.multiplier);
    const marginRate = parseFloat(form.margin_rate);
    if (form.multiplier.trim() === '' || isNaN(multiplier) || multiplier <= 0) {
      setError('Multiplier must be greater than 0');
      return;
    }
    if (form.margin_rate.trim() === '' || isNaN(marginRate) || marginRate < 0 || marginRate > 1) {
      setError('Margin rate must be between 0 and 1');
      return;
    }
    const tickerChanged = ticker !== asset.ticker.toUpperCase();
    setLoading(true);
    setError('');
    try {
      const payload: AssetUpdatePayload = {
        price_symbol: form.price_symbol.trim() || null,
        asset_type: form.asset_type,
        source: form.source,
        group_id: form.group_id ? parseInt(form.group_id) : null,
        multiplier,
        margin_rate: marginRate,
      };
      if (tickerChanged) payload.ticker = ticker;
      await api.updateAsset(asset.asset_id, payload);
      if (tickerChanged) {
        // The per-ticker price caches follow the rename.
        for (const prefix of ['asset_price_', 'cached_price_']) {
          const cached = localStorage.getItem(`${prefix}${asset.ticker}`);
          if (cached != null) {
            localStorage.setItem(`${prefix}${ticker}`, cached);
            localStorage.removeItem(`${prefix}${asset.ticker}`);
          }
        }
      }
      if (form.source === 'manual' && priceStr) {
        const priceNum = parseFloat(priceStr);
        if (!isNaN(priceNum)) {
          localStorage.setItem(`asset_price_${ticker}`, String(priceNum));
          await api.updateAsset(asset.asset_id, { price: priceNum });
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to update the asset', e);
      setError("Couldn't update the asset.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${asset.ticker}?`)) return;
    setLoading(true);
    try {
      await api.deleteAsset(asset.asset_id);
      localStorage.removeItem(`asset_price_${asset.ticker}`);
      onSaved();
      onClose();
    } catch (e) {
      console.error('Failed to delete the asset', e);
      setError("Couldn't delete the asset.");
    } finally {
      setLoading(false);
    }
  };

  const canDelete = !asset.sync_protected;
  const nextTicker = form.ticker.trim().toUpperCase();
  const tickerChanged = !!nextTicker && nextTicker !== asset.ticker.toUpperCase();

  return (
    <ModalShell open={open} onClose={onClose} title={"Edit Asset " + (asset?.ticker || '')} zIndex={9999}>
      <div className={`${MODAL_CARD} ${modalPanel}`} style={modalPanelStyle}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 12px' }}>Edit asset — {asset.ticker}</h3>

        <div className={MODAL_BODY}>
        {error && <div style={errorText} className="text-[length:var(--fs-label)]">{error}</div>}

        <p style={contextLine}>
          Broker {asset.broker_code ?? '—'} — renaming the ticker updates local orders, holdings and history; mapped broker orders keep their own symbol.
        </p>

        <div className="space-y-2.5">
          <div>
            <div className={rowTwo}>
              <Field className="min-w-0" label="Ticker" htmlFor="edit-asset-ticker" required>
                <TextInput id="edit-asset-ticker" value={form.ticker}
                  onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} />
              </Field>
              <Field className="min-w-0" label="Price symbol" htmlFor="edit-asset-price-symbol">
                <TextInput id="edit-asset-price-symbol" value={form.price_symbol}
                  onChange={e => setForm(p => ({ ...p, price_symbol: e.target.value }))}
                  placeholder={form.ticker.trim() || asset.ticker} />
              </Field>
            </div>
            <p style={CONTROL_HELPER}>Symbol used to fetch prices (yfinance / TFEX; TFEX accepts the series symbol like S50Z26 or the product-page URL — expired series return no quote); leave blank to use the Ticker</p>
          </div>
          <div className={rowThree}>
            <Field className="min-w-0" label="Type" htmlFor="edit-asset-type">
              <SelectInput id="edit-asset-type" value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </SelectInput>
            </Field>
            <Field className="min-w-0" label="Source" htmlFor="edit-asset-source">
              <SelectInput id="edit-asset-source" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </SelectInput>
            </Field>
            <Field className="min-w-0" label="Group" htmlFor="edit-asset-group">
              <SelectInput id="edit-asset-group" value={form.group_id} onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}>
                <option value="">None</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div>
            <div className={form.source === 'manual' ? rowThree : rowTwo}>
              <Field className="min-w-0" label="Multiplier" htmlFor="edit-asset-multiplier">
                <NumberInput id="edit-asset-multiplier" step="any" value={form.multiplier}
                  onChange={e => setForm(p => ({ ...p, multiplier: e.target.value }))}
                  placeholder="1" />
              </Field>
              <Field className="min-w-0" label="Margin rate" htmlFor="edit-asset-margin-rate">
                <NumberInput id="edit-asset-margin-rate" step="any" value={form.margin_rate}
                  onChange={e => setForm(p => ({ ...p, margin_rate: e.target.value }))}
                  placeholder="0" />
              </Field>
              {form.source === 'manual' && (
                <Field className="min-w-0" label="Price (manual)" htmlFor="edit-asset-price">
                  <NumberInput id="edit-asset-price" step="any" value={priceStr}
                    onChange={e => setPriceStr(e.target.value)}
                    placeholder="0.00" />
                </Field>
              )}
            </div>
            <p style={CONTROL_HELPER}>Margin 0.10 = 10% of notional</p>
          </div>
        </div>
        </div>

        {tickerChanged && (
          <div style={warningText} className="text-[length:var(--fs-label)]" role="status">
            Renaming the ticker updates local orders, holdings and history; mapped broker orders keep their own symbol.
          </div>
        )}

        <div className={`${MODAL_FOOTER} flex justify-between items-center`} style={{ marginTop: 12 }}>
          <div>
            {canDelete && (
              <button type="button" onClick={handleDelete} disabled={loading} className={actionButtonClass} style={dangerButton}>Delete</button>
            )}
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={loading} className={actionButtonClass} style={primaryButton}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default EditAssetModal;
