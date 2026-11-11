import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import ModalShell from './components/ModalShell';

interface AddAssetModalProps {
  open: boolean;
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

const errorText = {
  fontSize: 12,
  color: 'var(--color-danger-text)',
  background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)',
  borderRadius: 8,
  padding: '8px 10px',
  marginBottom: 12,
} as const;

const modalPanel = 'bg-canvas border border-hairline rounded-xl p-8 w-[420px] max-w-[90vw]';

const AddAssetModal: React.FC<AddAssetModalProps> = ({ open, onClose, onSaved, groups }) => {
  const [form, setForm] = useState({ ticker: '', name: '', asset_type: 'stock', source: 'manual', group_id: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && groups.length > 0) {
      const defaultGroup = groups.find(g => g.name === 'Watchlist') || groups[0];
      setForm(p => ({ ...p, group_id: String(defaultGroup.id) }));
    }
  }, [open, groups]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.ticker.trim()) { setError('Symbol is required'); return; }
    setLoading(true);
    setError('');
    try {
      await api.createAsset({
        ticker: form.ticker.trim(),
        name: form.name.trim() || form.ticker.trim(),
        asset_type: form.asset_type,
        source: form.source,
        group_id: form.group_id ? parseInt(form.group_id) : undefined,
      });
      onSaved();
      onClose();
      setForm({ ticker: '', name: '', asset_type: 'stock', source: 'manual', group_id: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Add Asset" zIndex={9999}>
      <div className={modalPanel}>
        <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 24px' }}>Add asset</h3>

        {error && <div style={errorText}>{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block" style={fieldLabel}>Symbol</label>
            <input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))}
              style={fieldControl} placeholder="e.g. AAPL" />
          </div>
          <div>
            <label className="block" style={fieldLabel}>Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={fieldControl} placeholder="Optional" />
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
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end" style={{ gap: 8, marginTop: 24 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={loading} style={primaryButton} className="transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Saving...' : 'Add asset'}</button>
        </div>
      </div>
    </ModalShell>
  );
};

export default AddAssetModal;
