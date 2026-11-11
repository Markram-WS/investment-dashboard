import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import ModalShell from './components/ModalShell';

interface EditAssetModalProps {
  open: boolean;
  asset: any;
  onClose: () => void;
  onSaved: () => void;
  groups: { id: number; name: string }[];
}

const SOURCES = ['manual', 'yfinance'];
const TYPES = ['stock', 'future', 'option', 'crypto'];

/** Field label: 12px/500 slate, sentence case. */
const fieldLabel = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-slate)',
  margin: '0 0 5px',
} as const;

/** Field control: 15px ink on canvas, 1px hairline, radius 8. */
const fieldControl = {
  width: '100%',
  fontSize: 15,
  color: 'var(--color-ink)',
  background: 'var(--color-canvas)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  padding: '8px 12px',
} as const;

const primaryButton = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  border: '1px solid var(--color-ink)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const dangerButton = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--color-canvas)',
  color: 'var(--color-danger-text)',
  border: '1px solid var(--color-danger-text)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const errorText = {
  fontSize: 12,
  color: 'var(--color-danger-text)',
  background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)',
  borderRadius: 8,
  padding: '8px 10px',
  marginBottom: 12,
} as const;

const actionButtonClass = 'transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
const modalPanel = 'bg-canvas border border-hairline rounded-xl p-8 w-[420px] max-w-[90vw]';

const EditAssetModal: React.FC<EditAssetModalProps> = ({ open, asset, onClose, onSaved, groups }) => {
  const [form, setForm] = useState({ name: '', asset_type: 'stock', source: 'manual', group_id: '' });
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
      });
      setPriceStr(asset.price != null ? String(asset.price) : '');
    }
  }, [asset]);

  if (!open || !asset) return null;

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await api.updateAsset(asset.asset_id, {
        name: form.name || asset.ticker,
        asset_type: form.asset_type,
        source: form.source,
        group_id: form.group_id ? parseInt(form.group_id) : null,
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
        <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 24px' }}>Edit asset — {asset.ticker}</h3>

        {error && <div style={errorText}>{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block" style={fieldLabel}>Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={fieldControl} />
          </div>
          <div className="flex gap-3">
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
          {form.source === 'manual' && (
            <div>
              <label className="block" style={fieldLabel}>Price (manual)</label>
              <input type="number" step="any" value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                style={fieldControl} placeholder="0.00" />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center" style={{ marginTop: 24 }}>
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
