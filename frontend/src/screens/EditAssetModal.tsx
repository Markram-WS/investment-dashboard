import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import ModalShell from './components/ModalShell';

/** Editable asset shape read by this modal (callers may pass the raw row). */
interface EditableAsset {
  asset_id: number;
  ticker: string;
  name?: string | null;
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

const SOURCES = ['manual', 'yfinance'];
const TYPES = ['stock', 'future', 'option', 'crypto'];

/** Field label: 11px/500 slate, sentence case. */
const fieldLabel = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--color-slate)',
  margin: '0 0 4px',
} as const;

/** Field control: 13px ink on canvas, 1px hairline, radius 8. */
const fieldControl = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 13,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-ink)',
  background: 'var(--color-canvas)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  padding: '5px 9px',
} as const;

const helperText = {
  fontSize: 11,
  color: 'var(--color-slate)',
  margin: '4px 0 0',
} as const;

const contextLine = {
  fontSize: 11,
  color: 'var(--color-slate)',
  margin: '0 0 10px',
} as const;

const primaryButton = {
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  border: '1px solid var(--color-ink)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const dangerButton = {
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-danger-text)',
  border: '1px solid var(--color-danger-text)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const errorText = {
  fontSize: 11,
  color: 'var(--color-danger-text)',
  background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)',
  borderRadius: 8,
  padding: '6px 8px',
  marginBottom: 12,
} as const;

const actionButtonClass = 'transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
const modalPanel = 'bg-canvas border border-hairline rounded-xl p-4 w-[400px] max-w-[90vw]';

const EditAssetModal: React.FC<EditAssetModalProps> = ({ open, asset, onClose, onSaved, groups }) => {
  const [form, setForm] = useState({ name: '', asset_type: 'stock', source: 'manual', group_id: '', multiplier: '1', margin_rate: '0' });
  const [priceStr, setPriceStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (asset) {
      setForm({
        name: asset.name || '',
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
    setLoading(true);
    setError('');
    try {
      await api.updateAsset(asset.asset_id, {
        name: form.name || asset.ticker,
        asset_type: form.asset_type,
        source: form.source,
        group_id: form.group_id ? parseInt(form.group_id) : null,
        multiplier,
        margin_rate: marginRate,
      });
      if (form.source === 'manual' && priceStr) {
        const priceNum = parseFloat(priceStr);
        if (!isNaN(priceNum)) {
          localStorage.setItem(`asset_price_${asset.ticker}`, String(priceNum));
          await api.updateAsset(asset.asset_id, { price: priceNum });
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update asset');
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
      setError(e instanceof Error ? e.message : 'Failed to delete asset');
    } finally {
      setLoading(false);
    }
  };

  const canDelete = !asset.sync_protected;

  return (
    <ModalShell open={open} onClose={onClose} title={"Edit Asset " + (asset?.ticker || '')} zIndex={9999}>
      <div className={modalPanel}>
        <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 12px' }}>Edit asset — {asset.ticker}</h3>

        {error && <div style={errorText}>{error}</div>}

        <p style={contextLine}>
          Symbol {asset.ticker} · Broker {asset.broker_code ?? '—'} — symbol and broker are fixed after creation.
        </p>

        <div className="space-y-2.5">
          <div>
            <label className="block" style={fieldLabel}>Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={fieldControl} />
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Type</label>
              <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))}
                style={fieldControl}>
                {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block" style={fieldLabel}>Source</label>
              <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                style={fieldControl}>
                {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block" style={fieldLabel}>Group</label>
            <select value={form.group_id} onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}
              style={fieldControl}>
              <option value="">None</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <label className="block" style={fieldLabel}>Multiplier</label>
                <input type="number" step="any" value={form.multiplier}
                  onChange={e => setForm(p => ({ ...p, multiplier: e.target.value }))}
                  style={fieldControl} placeholder="1" />
              </div>
              <div className="flex-1">
                <label className="block" style={fieldLabel}>Margin rate</label>
                <input type="number" step="any" value={form.margin_rate}
                  onChange={e => setForm(p => ({ ...p, margin_rate: e.target.value }))}
                  style={fieldControl} placeholder="0" />
              </div>
            </div>
            <p style={helperText}>Margin 0.10 = 10% of notional</p>
          </div>
          {form.source === 'manual' && (
            <div>
              <label className="block" style={fieldLabel}>Price (manual)</label>
              <input type="number" step="any" value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                style={fieldControl} placeholder="0.00" />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center" style={{ marginTop: 16 }}>
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
