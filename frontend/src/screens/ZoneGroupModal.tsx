import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import ModalShell from './components/ModalShell';

interface ZoneGroupRecord {
  id: number;
  portfolio_id: number;
  name: string;
  max_orders: number | null;
  min_price: number | null;
  max_price: number | null;
  range: number | null;
}

interface ZoneGroupModalProps {
  showModal: boolean;
  onClose: () => void;
  portfolioId: number;
  onSaved?: () => void;
}

const emptyForm = {
  name: '',
  max_orders: '',
  min_price: '',
  max_price: '',
  range: '',
};

export const ZoneGroupModal: React.FC<ZoneGroupModalProps> = ({
  showModal,
  onClose,
  portfolioId,
  onSaved,
}) => {
  const [zones, setZones] = useState<ZoneGroupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getZoneGroups(portfolioId);
      setZones(data);
    } catch (err) {
      console.error('Failed to load order groups:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (showModal) fetchZones();
  }, [showModal, fetchZones]);

  const sortedZones = useMemo(() => {
    return [...zones].sort((a, b) => {
      const aMin = a.min_price ?? Number.NEGATIVE_INFINITY;
      const bMin = b.min_price ?? Number.NEGATIVE_INFINITY;
      if (bMin !== aMin) return bMin - aMin;
      const aMax = a.max_price ?? Number.NEGATIVE_INFINITY;
      const bMax = b.max_price ?? Number.NEGATIVE_INFINITY;
      if (bMax !== aMax) return bMax - aMax;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [zones]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setShowForm(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (zone: ZoneGroupRecord) => {
    setForm({
      name: zone.name,
      max_orders: zone.max_orders !== null ? String(zone.max_orders) : '',
      min_price: zone.min_price !== null ? String(zone.min_price) : '',
      max_price: zone.max_price !== null ? String(zone.max_price) : '',
      range: zone.range !== null ? String(zone.range) : '',
    });
    setEditingId(zone.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteZoneGroup(id, portfolioId);
      fetchZones();
      onSaved?.();
    } catch (err) {
      console.error('Failed to delete order group:', err);
    }
  };

  const handleSave = async () => {
    const payload: Record<string, any> = {
      name: form.name,
    };
    if (form.max_orders !== '') payload.max_orders = parseInt(form.max_orders, 10);
    if (form.min_price !== '') payload.min_price = parseFloat(form.min_price);
    if (form.max_price !== '') payload.max_price = parseFloat(form.max_price);
    if (form.range !== '') payload.range = parseFloat(form.range);

    try {
      if (editingId !== null) {
        await api.updateZoneGroup(editingId, payload, portfolioId);
      } else {
        await api.createZoneGroup(portfolioId, payload);
      }
      resetForm();
      fetchZones();
      onSaved?.();
    } catch (err) {
      console.error('Failed to save order group:', err);
    }
  };

  if (!showModal) return null;

  return (
    <ModalShell open={showModal} onClose={onClose} title="Order Groups">
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Order Groups</h3>
          <button onClick={onClose} className="text-slate hover:text-ink text-xl leading-none">&times;</button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-surface rounded-lg border border-hairline">
            <h4 className="font-semibold text-sm mb-3">{editingId ? 'Edit Group' : 'New Group'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate mb-1">Group Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate mb-1">Max Orders <span className="font-normal lowercase text-slate">(∞ if empty)</span></label>
                <input type="number" step="1" value={form.max_orders} onChange={(e) => setForm({ ...form, max_orders: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="leave empty = unlimited" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate mb-1">Min Price</label>
                <input type="number" step="any" value={form.min_price} onChange={(e) => setForm({ ...form, min_price: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="nullable" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate mb-1">Max Price</label>
                <input type="number" step="any" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="nullable" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate mb-1">Range</label>
                <input type="number" step="any" value={form.range} onChange={(e) => setForm({ ...form, range: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="for grid calculation" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={resetForm} className="px-4 py-2 text-xs font-medium border rounded hover:bg-surface-soft transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-xs font-bold bg-black text-white rounded hover:bg-gray-800 transition-colors">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate text-sm py-4 text-center">Loading...</p>
        ) : sortedZones.length === 0 && !showForm ? (
          <p className="text-slate text-sm py-4 text-center">No order groups defined yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-hairline">
                <th className="pb-2 text-[10px] font-bold text-slate uppercase tracking-widest">Group</th>
                <th className="pb-2 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Max Orders</th>
                <th className="pb-2 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Min Price</th>
                <th className="pb-2 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Max Price</th>
                <th className="pb-2 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Range</th>
                <th className="pb-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {sortedZones.map((zone) => (
                <tr key={zone.id} className="border-b border-gray-100">
                  <td className="py-3 font-semibold text-sm">{zone.name}</td>
                  <td className="py-3 text-sm text-right">{zone.max_orders != null ? zone.max_orders : '∞'}</td>
                  <td className="py-3 text-sm text-right">{zone.min_price != null ? `$${zone.min_price.toLocaleString()}` : '-'}</td>
                  <td className="py-3 text-sm text-right">{zone.max_price != null ? `$${zone.max_price.toLocaleString()}` : '-'}</td>
                  <td className="py-3 text-sm text-right">{zone.range != null ? `$${zone.range.toLocaleString()}` : '-'}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => handleEdit(zone)} className="inline-flex items-center justify-center p-1.5 text-slate hover:text-black transition-colors" title="Edit">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(zone.id)} className="inline-flex items-center justify-center p-1.5 text-red-300 hover:text-red-500 transition-colors" title="Delete">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between mt-6">
          {!showForm && (
            <button onClick={handleAdd} className="px-4 py-2 text-xs font-bold bg-black text-white rounded hover:bg-gray-800 transition-colors">
              + Add Group
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-5 py-2 text-sm font-medium border rounded hover:bg-surface-soft transition-colors">
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
