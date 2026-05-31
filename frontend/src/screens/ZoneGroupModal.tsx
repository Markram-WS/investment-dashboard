import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

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
      console.error('Failed to load zone groups:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (showModal) fetchZones();
  }, [showModal, fetchZones]);

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
      await api.deleteZoneGroup(id);
      fetchZones();
    } catch (err) {
      console.error('Failed to delete zone group:', err);
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
        await api.updateZoneGroup(editingId, payload);
      } else {
        await api.createZoneGroup(portfolioId, payload);
      }
      resetForm();
      fetchZones();
    } catch (err) {
      console.error('Failed to save zone group:', err);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Zone Groups</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-sm mb-3">{editingId ? 'Edit Zone' : 'New Zone'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Group/Zone Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Max Orders</label>
                <input type="number" step="1" value={form.max_orders} onChange={(e) => setForm({ ...form, max_orders: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="nullable" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Min Price</label>
                <input type="number" step="any" value={form.min_price} onChange={(e) => setForm({ ...form, min_price: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="nullable" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Max Price</label>
                <input type="number" step="any" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="nullable" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Range</label>
                <input type="number" step="any" value={form.range} onChange={(e) => setForm({ ...form, range: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="for grid calculation" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={resetForm} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="px-3 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm py-4 text-center">Loading...</p>
        ) : zones.length === 0 && !showForm ? (
          <p className="text-gray-500 text-sm py-4 text-center">No zone groups defined yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Zone</th>
                <th className="pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Max Orders</th>
                <th className="pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Min Price</th>
                <th className="pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Max Price</th>
                <th className="pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Range</th>
                <th className="pb-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b border-gray-100">
                  <td className="py-3 font-semibold text-sm">{zone.name}</td>
                  <td className="py-3 text-sm text-right">{zone.max_orders ?? '-'}</td>
                  <td className="py-3 text-sm text-right">{zone.min_price != null ? `$${zone.min_price.toLocaleString()}` : '-'}</td>
                  <td className="py-3 text-sm text-right">{zone.max_price != null ? `$${zone.max_price.toLocaleString()}` : '-'}</td>
                  <td className="py-3 text-sm text-right">{zone.range != null ? `$${zone.range.toLocaleString()}` : '-'}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => handleEdit(zone)} className="text-xs text-gray-500 hover:text-black mr-2">Edit</button>
                    <button onClick={() => handleDelete(zone.id)} className="text-xs text-red-400 hover:text-red-600">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-between mt-6">
          {!showForm && (
            <button onClick={handleAdd} className="px-4 py-2 text-xs bg-black text-white rounded-full hover:bg-gray-800">
              + Add Zone
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50 ml-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
