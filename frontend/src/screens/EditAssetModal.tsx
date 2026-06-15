import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Button from './components/Button';
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
    } catch (e: any) {
      setError(e.message || 'Failed to update asset');
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
    } catch (e: any) {
      setError(e.message || 'Failed to delete asset');
    } finally {
      setLoading(false);
    }
  };

  const canDelete = !asset.sync_protected;

  return (
    <ModalShell open={open} onClose={onClose} title={"Edit Asset " + (asset?.ticker || '')} backdropClassName="bg-black/40" zIndex={9999}>
      <div className="bg-canvas rounded-[20px] p-8 w-[420px] max-w-[90vw] shadow-xl">
        <h3 className="text-lg font-bold text-ink mb-6">Edit Asset — {asset.ticker}</h3>

        {error && <div className="text-red-600 text-xs mb-3 bg-red-50 p-2 rounded">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-1">Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink" />
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
              <option value="">None</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          {form.source === 'manual' && (
            <div>
              <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-1">Price (Manual)</label>
              <input type="number" step="any" value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink" placeholder="0.00" />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-6">
          <div>
            {canDelete && (
              <Button variant="danger" onClick={handleDelete} disabled={loading}>Delete</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default EditAssetModal;
