import React, { useState, useEffect } from 'react';
import { api, type AssetGroupRecord } from '../lib/api';
import ModalShell from './components/ModalShell';

interface AssetGroupModalProps {
  open: boolean;
  onClose: () => void;
}

const emptyForm = { name: '' };

/** Column head: 12px/500 slate, sentence case. */
const headCell = { fontSize: 12, fontWeight: 500, color: 'var(--color-slate)', margin: 0 } as const;

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

/** Badge: 12px/500 slate on surface-soft, pill radius. */
const badgeStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-slate)',
  background: 'var(--color-surface-soft)',
  borderRadius: 999,
  padding: '2px 10px',
  whiteSpace: 'nowrap',
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

const actionButtonClass = 'transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
const modalPanel = 'bg-canvas border border-hairline rounded-xl p-6 w-full max-w-lg mx-4';

const AssetGroupModal: React.FC<AssetGroupModalProps> = ({ open, onClose }) => {
  const [groups, setGroups] = useState<AssetGroupRecord[]>([]);
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

  const handleEdit = (g: AssetGroupRecord) => {
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
    <ModalShell open={open} onClose={onClose} title="Asset Groups">
      <div className={modalPanel}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0 }}>Asset groups</h3>
          <button onClick={onClose} className="text-slate hover:text-ink leading-none" style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>

        {showForm && (
          <div className="mb-6" style={{ borderTop: '1px solid var(--color-hairline)', borderBottom: '1px solid var(--color-hairline)', padding: '16px 0' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 10px' }}>{editingId ? 'Edit group' : 'New group'}</h4>
            <div className="flex" style={{ gap: 8 }}>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Group name"
                style={fieldControl} />
            </div>
            <div className="flex justify-end" style={{ gap: 8, marginTop: 12 }}>
              <button type="button" onClick={resetForm} style={secondaryButton}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={!form.name.trim()} className={actionButtonClass} style={primaryButton}>
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center py-4" style={{ fontSize: 13, color: 'var(--color-slate)' }}>Loading...</p>
        ) : groups.length === 0 && !showForm ? (
          <p className="text-center py-4" style={{ fontSize: 13, color: 'var(--color-slate)' }}>No asset groups defined yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                <th style={{ ...headCell, paddingBottom: 8 }}>Group</th>
                <th style={{ ...headCell, paddingBottom: 8, textAlign: 'right' }}>Default</th>
                <th className="w-16" style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid var(--color-hairline-soft)' }}>
                  <td style={{ padding: '10px 0', fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>{g.name}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {g.is_default && <span style={badgeStyle}>default</span>}
                  </td>
                  <td className="whitespace-nowrap" style={{ padding: '10px 0', textAlign: 'right' }}>
                    <button onClick={() => handleEdit(g)} className="inline-flex items-center justify-center p-1.5 text-slate hover:text-ink transition-colors" title="Edit">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {!g.is_default && (
                      <button onClick={() => handleDelete(g.id)} className="inline-flex items-center justify-center p-1.5 transition-opacity hover:opacity-70" style={{ color: 'var(--color-danger-text)' }} title="Delete">
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

        <div className="flex items-center justify-between" style={{ marginTop: 24 }}>
          {!showForm && (
            <button onClick={handleAdd} style={primaryButton}>
              + Add group
            </button>
          )}
          <button onClick={onClose} className="ml-auto" style={secondaryButton}>
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default AssetGroupModal;
