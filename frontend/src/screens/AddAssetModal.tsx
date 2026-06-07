import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Button from './components/Button';

interface AddAssetModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  groups: { id: number; name: string }[];
}

const SOURCES = ['manual', 'yfinance'];
const TYPES = ['stock', 'future', 'option', 'crypto'];

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
    } catch (e: any) {
      setError(e.message || 'Failed to create asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-canvas rounded-[20px] p-8 w-[420px] max-w-[90vw] shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-ink mb-6">Add Asset</h3>

        {error && <div className="text-red-600 text-xs mb-3 bg-red-50 p-2 rounded">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-1">Symbol</label>
            <input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))}
              className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink" placeholder="e.g. AAPL" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-1">Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink" placeholder="Optional" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-1">Type</label>
              <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))}
                className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-1">Source</label>
              <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink">
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-1">Group</label>
            <select value={form.group_id} onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}
              className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink">
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Add Asset'}</Button>
        </div>
      </div>
    </div>
  );
};

export default AddAssetModal;
