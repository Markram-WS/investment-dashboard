import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Button from './components/Button';

interface AssetGroupModalProps {
  open: boolean;
  onClose: () => void;
}

const emptyForm = { name: '' };

const AssetGroupModal: React.FC<AssetGroupModalProps> = ({ open, onClose }) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await api.getAssetGroups();
      setGroups(data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchGroups();
  }, [open]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setShowForm(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (g: any) => {
    setForm({ name: g.name });
    setEditingId(g.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this group? Assets will be ungrouped.')) return;
    try {
      await api.deleteAssetGroup(id);
      fetchGroups();
    } catch { }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingId !== null) {
        await api.updateAssetGroup(editingId, { name: form.name.trim() });
      } else {
        await api.createAssetGroup({ name: form.name.trim() });
      }
      resetForm();
      fetchGroups();
    } catch { }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Asset Groups</h3>
          <button onClick={onClose} className="text-slate hover:text-ink text-xl leading-none">&times;</button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-surface rounded-lg border border-hairline">
            <h4 className="font-semibold text-sm mb-3">{editingId ? 'Edit Group' : 'New Group'}</h4>
            <div className="flex gap-2">
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Group name"
                className="flex-1 text-sm border border-hairline rounded-lg px-3 py-2 bg-canvas text-ink" />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={resetForm} className="px-4 py-2 text-xs font-medium border rounded hover:bg-surface transition-colors">Cancel</button>
              <Button variant="primary" onClick={handleSave} disabled={!form.name.trim()}>
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate text-sm py-4 text-center">Loading...</p>
        ) : groups.length === 0 && !showForm ? (
          <p className="text-slate text-sm py-4 text-center">No asset groups defined yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-hairline">
                <th className="pb-2 text-[10px] font-bold text-slate uppercase tracking-widest">Group</th>
                <th className="pb-2 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Default</th>
                <th className="pb-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-3 font-semibold text-sm">{g.name}</td>
                  <td className="py-3 text-sm text-right">
                    {g.is_default && <span className="text-[9px] text-slate bg-surface px-1.5 py-0.5 rounded">default</span>}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => handleEdit(g)} className="inline-flex items-center justify-center p-1.5 text-slate hover:text-ink transition-colors" title="Edit">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {!g.is_default && (
                      <button onClick={() => handleDelete(g.id)} className="inline-flex items-center justify-center p-1.5 text-red-300 hover:text-red-500 transition-colors" title="Delete">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between mt-6">
          {!showForm && (
            <button onClick={handleAdd} className="px-4 py-2 text-xs font-bold bg-ink text-canvas rounded-full hover:opacity-80 transition-all">
              + Add Group
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-5 py-2 text-sm font-medium border border-hairline rounded-full hover:bg-surface transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetGroupModal;
