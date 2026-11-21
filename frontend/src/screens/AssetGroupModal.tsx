import React, { useState, useEffect } from 'react';
import { api, type AssetGroupRecord } from '../lib/api';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import IconButton from '../components/IconButton';
import { TextInput } from './components/Field';
import { CONTROL_TITLE } from './components/controlStyles';

interface AssetGroupModalProps {
  open: boolean;
  onClose: () => void;
}

const emptyForm = { name: '' };

/** Column head: 12px/500 slate, sentence case. */
const headCell = { fontWeight: 500, color: 'var(--color-slate)', margin: 0 } as const;

/** Badge: 12px/500 slate on surface-soft, pill radius. */
const badgeStyle = {
  fontWeight: 500,
  color: 'var(--color-slate)',
  background: 'var(--color-surface-soft)',
  borderRadius: 999,
  padding: '2px 10px',
  whiteSpace: 'nowrap',
} as const;

const primaryButton = {
  padding: '8px 16px',
  fontWeight: 500,
  background: 'var(--color-ink)',
  color: 'var(--color-canvas)',
  border: '1px solid var(--color-ink)',
  borderRadius: 999,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  padding: '8px 16px',
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
    } catch {
      // Keep the previous list when the group fetch fails.
    }
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
    } catch {
      // Keep the modal list unchanged when the delete fails.
    }
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
    } catch {
      // Keep the form open when saving fails.
    }
  };

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} title="Asset Groups">
      <div className={`${MODAL_CARD} ${modalPanel}`}>
        <div className={`${MODAL_HEADER} flex items-center justify-between`} style={{ marginBottom: 16 }}>
          <h3 style={CONTROL_TITLE}>Asset groups</h3>
          <button onClick={onClose} className="text-xl text-slate hover:text-ink leading-none" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>

        <div className={MODAL_BODY}>
        {showForm && (
          <div className="mb-6" style={{ borderTop: '1px solid var(--color-hairline)', borderBottom: '1px solid var(--color-hairline)', padding: '16px 0' }}>
            <h4 className="text-[length:var(--fs-body)]" style={{ fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 10px' }}>{editingId ? 'Edit group' : 'New group'}</h4>
            <div className="flex" style={{ gap: 8 }}>
              <TextInput type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Group name"
                aria-label="Group name" />
            </div>
            <div className="flex justify-end" style={{ gap: 8, marginTop: 12 }}>
              <button type="button" onClick={resetForm} className="text-[length:var(--fs-body)]" style={secondaryButton}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={!form.name.trim()} className={`${actionButtonClass} text-[length:var(--fs-body)]`} style={primaryButton}>
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse" aria-hidden="true">
            <div className="flex items-center gap-6 pb-2" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
              <div className="h-3 bg-surface rounded w-24" />
              <div className="ml-auto h-3 bg-surface rounded w-16" />
              <div className="h-3 bg-surface rounded w-10" />
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-6 py-2.5" style={{ borderBottom: '1px solid var(--color-hairline-soft)' }}>
                <div className="h-4 bg-surface rounded w-40" />
                <div className="ml-auto h-3 bg-surface rounded w-14" />
                <div className="h-4 bg-surface rounded w-10" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 && !showForm ? (
          <p className="text-center py-4 text-[length:var(--fs-body)]" style={{ color: 'var(--color-slate)' }}>No asset groups defined yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                <th className="text-xs" style={{ ...headCell, paddingBottom: 8 }}>Group</th>
                <th className="text-xs" style={{ ...headCell, paddingBottom: 8, textAlign: 'right' }}>Default</th>
                <th className="w-16" style={{ paddingBottom: 8 }} />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid var(--color-hairline-soft)' }}>
                  <td className="text-[length:var(--fs-content)]" style={{ padding: '10px 0', fontWeight: 600, color: 'var(--color-ink)' }}>{g.name}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {g.is_default && <span className="text-xs" style={badgeStyle}>default</span>}
                  </td>
                  <td className="whitespace-nowrap" style={{ padding: '10px 0', textAlign: 'right' }}>
                    <IconButton label="Edit" onClick={() => handleEdit(g)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </IconButton>
                    {!g.is_default && (
                      <IconButton label="Delete" danger onClick={() => handleDelete(g.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>

        <div className={`${MODAL_FOOTER} flex items-center justify-between`} style={{ marginTop: 12, borderTop: '1px solid var(--color-hairline)', paddingTop: 12 }}>
          {!showForm && (
            <button onClick={handleAdd} className="text-[length:var(--fs-body)]" style={primaryButton}>
              + Add group
            </button>
          )}
          <button onClick={onClose} className="ml-auto text-[length:var(--fs-body)]" style={secondaryButton}>
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default AssetGroupModal;
