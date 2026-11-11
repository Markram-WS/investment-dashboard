import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import ModalShell from './components/ModalShell';

const CARD: React.CSSProperties = { background: 'var(--color-canvas)', borderRadius: 16, padding: 24 };
const TITLE: React.CSSProperties = {
  fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0,
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-slate)', margin: '0 0 6px',
};
const HEAD: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--color-slate)', paddingBottom: 8, textAlign: 'left',
};
const CELL: React.CSSProperties = {
  fontSize: 15, fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)', padding: '10px 0',
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '6px 10px', fontSize: 15, fontWeight: 500,
  fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)', background: 'transparent',
  borderRadius: 8,
};
const BTN: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, borderRadius: 999, padding: '6px 14px',
  border: '1px solid transparent', cursor: 'pointer',
};
const BTN_PRIMARY: React.CSSProperties = {
  ...BTN, background: 'var(--color-ink)', color: 'var(--color-canvas)',
};
const BTN_SECONDARY: React.CSSProperties = {
  ...BTN, background: 'transparent', color: 'var(--color-ink)', borderColor: 'var(--color-hairline)',
};

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
    <ModalShell open={showModal} onClose={onClose} title="Order groups">
      <div className="w-full max-w-2xl mx-4" style={CARD}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h3 style={TITLE}>Order groups</h3>
          <button onClick={onClose} className="text-slate hover:text-ink leading-none" style={{ fontSize: 20 }}>&times;</button>
        </div>

        {showForm && (
          <div style={{ paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--color-hairline)' }}>
            <h4 style={{ ...LABEL, fontSize: 15, color: 'var(--color-ink)', marginBottom: 12 }}>{editingId ? 'Edit group' : 'New group'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={LABEL}>Group name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-hairline focus:border-brand-teal" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Max orders <span style={{ fontWeight: 400 }}>(∞ if empty)</span></label>
                <input type="number" step="1" value={form.max_orders} onChange={(e) => setForm({ ...form, max_orders: e.target.value })} className="border border-hairline focus:border-brand-teal" style={INPUT} placeholder="leave empty = unlimited" />
              </div>
              <div>
                <label style={LABEL}>Min price</label>
                <input type="number" step="any" value={form.min_price} onChange={(e) => setForm({ ...form, min_price: e.target.value })} className="border border-hairline focus:border-brand-teal" style={INPUT} placeholder="nullable" />
              </div>
              <div>
                <label style={LABEL}>Max price</label>
                <input type="number" step="any" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} className="border border-hairline focus:border-brand-teal" style={INPUT} placeholder="nullable" />
              </div>
              <div>
                <label style={LABEL}>Range</label>
                <input type="number" step="any" value={form.range} onChange={(e) => setForm({ ...form, range: e.target.value })} className="border border-hairline focus:border-brand-teal" style={INPUT} placeholder="for grid calculation" />
              </div>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: 12 }}>
              <button onClick={resetForm} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">Cancel</button>
              <button onClick={handleSave} style={BTN_PRIMARY} className="transition-opacity hover:opacity-90">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center" style={{ fontSize: 15, color: 'var(--color-slate)', padding: '16px 0', margin: 0 }}>Loading...</p>
        ) : sortedZones.length === 0 && !showForm ? (
          <p className="text-center" style={{ fontSize: 15, color: 'var(--color-slate)', padding: '16px 0', margin: 0 }}>No order groups defined yet.</p>
        ) : (
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={HEAD}>Group</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Max orders</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Min price</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Max price</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Range</th>
                <th style={{ ...HEAD, width: 64 }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedZones.map((zone) => (
                <tr key={zone.id} style={{ borderTop: '1px solid var(--color-hairline-soft)' }}>
                  <td style={{ ...CELL, fontWeight: 600 }}>{zone.name}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{zone.max_orders != null ? zone.max_orders : '∞'}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{zone.min_price != null ? `$${zone.min_price.toLocaleString()}` : '-'}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{zone.max_price != null ? `$${zone.max_price.toLocaleString()}` : '-'}</td>
                  <td style={{ ...CELL, textAlign: 'right' }}>{zone.range != null ? `$${zone.range.toLocaleString()}` : '-'}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleEdit(zone)} className="inline-flex items-center justify-center p-1.5 text-slate hover:text-ink transition-colors" title="Edit">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(zone.id)} className="inline-flex items-center justify-center p-1.5 opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--color-danger-text)' }} title="Delete">
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

        <div className="flex items-center justify-between" style={{ marginTop: 24 }}>
          {!showForm && (
            <button onClick={handleAdd} style={BTN_PRIMARY} className="transition-opacity hover:opacity-90">
              + Add group
            </button>
          )}
          <button onClick={onClose} style={BTN_SECONDARY} className="ml-auto transition-colors hover:bg-surface-soft">
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
