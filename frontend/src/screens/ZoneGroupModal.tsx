import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import IconButton from '../components/IconButton';
import { priceLabel, formatMoney } from '../utils/format';
import { NumberInput, TextInput } from './components/Field';
import { CONTROL_TITLE } from './components/controlStyles';

const CARD: React.CSSProperties = { background: 'var(--color-canvas)', borderRadius: 16, padding: 24 };
const GRID_COLS = 'minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 64px';
const GRID_ROW: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: GRID_COLS, columnGap: 12, alignItems: 'center',
};
const HEAD_CELL: React.CSSProperties = {
  fontWeight: 500, color: 'var(--color-slate)', paddingBottom: 6,
  whiteSpace: 'nowrap', minWidth: 0,
};
const CELL: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)', minWidth: 0,
};
const BTN: React.CSSProperties = {
  fontWeight: 500, borderRadius: 999, padding: '3px 10px', lineHeight: 1.3,
  border: '1px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap',
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

const toPayload = (form: typeof emptyForm) => {
  const payload: Record<string, unknown> = { name: form.name };
  if (form.max_orders !== '') payload.max_orders = parseInt(form.max_orders, 10);
  if (form.min_price !== '') payload.min_price = parseFloat(form.min_price);
  if (form.max_price !== '') payload.max_price = parseFloat(form.max_price);
  if (form.range !== '') payload.range = parseFloat(form.range);
  return payload;
};

export const ZoneGroupModal: React.FC<ZoneGroupModalProps> = ({
  showModal,
  onClose,
  portfolioId,
  onSaved,
}) => {
  const [zones, setZones] = useState<ZoneGroupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [newForm, setNewForm] = useState({ ...emptyForm });

  const fetchZones = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    try {
      const data = await api.getZoneGroups(portfolioId);
      setZones(data);
    } catch (err) {
      console.error('Failed to load order groups:', err);
    } finally {
      if (!silent) setLoading(false);
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

  const handleEdit = (zone: ZoneGroupRecord) => {
    setEditForm({
      name: zone.name,
      max_orders: zone.max_orders !== null ? String(zone.max_orders) : '',
      min_price: zone.min_price !== null ? String(zone.min_price) : '',
      max_price: zone.max_price !== null ? String(zone.max_price) : '',
      range: zone.range !== null ? String(zone.range) : '',
    });
    setEditingId(zone.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ ...emptyForm });
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteZoneGroup(id, portfolioId);
      fetchZones({ silent: true });
      onSaved?.();
    } catch (err) {
      console.error('Failed to delete order group:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    try {
      await api.updateZoneGroup(editingId, toPayload(editForm), portfolioId);
      handleCancelEdit();
      fetchZones({ silent: true });
      onSaved?.();
    } catch (err) {
      console.error('Failed to save order group:', err);
    }
  };

  const handleCreate = async () => {
    try {
      await api.createZoneGroup(portfolioId, toPayload(newForm));
      setNewForm({ ...emptyForm });
      fetchZones({ silent: true });
      onSaved?.();
    } catch (err) {
      console.error('Failed to save order group:', err);
    }
  };

  if (!showModal) return null;

  return (
    <ModalShell open={showModal} onClose={onClose} title="Zones">
      <div className={`${MODAL_CARD} w-full max-w-3xl mx-4`} style={CARD}>
        <div className={`${MODAL_HEADER} flex items-center justify-between`} style={{ marginBottom: 12 }}>
          <h3 style={CONTROL_TITLE}>Zones</h3>
          <button onClick={onClose} className="text-xl text-slate hover:text-ink leading-none">&times;</button>
        </div>

        <div className={MODAL_BODY}>
        {loading && sortedZones.length === 0 ? (
          <div className="animate-pulse" aria-hidden="true">
            <div style={{ ...GRID_ROW, paddingBottom: 6 }}>
              {[0, 1, 2, 3, 4].map((col) => (
                <div
                  key={col}
                  className="h-3 bg-surface rounded"
                  style={{ width: col === 0 ? 72 : 48, justifySelf: col === 0 ? "start" : "end" }}
                />
              ))}
              <div />
            </div>
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                style={{ ...GRID_ROW, padding: "6px 0", borderTop: "1px solid var(--color-hairline-soft)" }}
              >
                {[0, 1, 2, 3, 4].map((col) => (
                  <div
                    key={col}
                    className="h-4 bg-surface rounded"
                    style={{ width: col === 0 ? 120 : 56, justifySelf: col === 0 ? "start" : "end" }}
                  />
                ))}
                <div className="h-4 bg-surface rounded" style={{ width: 48 }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {sortedZones.length === 0 && (
              <div style={{ padding: '4px 0 12px' }}>
                <p className="text-[length:var(--fs-body)]" style={{ fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>No zones yet.</p>
                <p className="text-[length:var(--fs-label)]" style={{ color: 'var(--color-slate)', margin: '2px 0 0' }}>Add a price level to group orders under it.</p>
              </div>
            )}
            <div className="overflow-x-hidden">
              <div style={{ ...GRID_ROW, position: 'sticky', top: 0, background: 'var(--color-canvas)', zIndex: 1 }}>
                <div className="text-[length:var(--fs-label)]" style={HEAD_CELL}>Price</div>
                <div className="text-[length:var(--fs-label)]" style={{ ...HEAD_CELL, textAlign: 'right' }}>Max orders</div>
                <div className="text-[length:var(--fs-label)]" style={{ ...HEAD_CELL, textAlign: 'right' }}>Min price</div>
                <div className="text-[length:var(--fs-label)]" style={{ ...HEAD_CELL, textAlign: 'right' }}>Max price</div>
                <div className="text-[length:var(--fs-label)]" style={{ ...HEAD_CELL, textAlign: 'right' }}>Step</div>
                <div className="text-[length:var(--fs-label)]" style={HEAD_CELL} aria-hidden="true" />
              </div>
              {sortedZones.map((zone) => {
                const isEditing = editingId === zone.id;
                return (
                  <div
                    key={zone.id}
                    style={{ ...GRID_ROW, padding: '3px 0', borderTop: '1px solid var(--color-hairline-soft)' }}
                    onKeyDown={(e) => {
                      if (isEditing && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
                        e.preventDefault();
                        handleSaveEdit();
                      }
                    }}
                  >
                    {isEditing ? (
                      <>
                        <TextInput
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          aria-label="Zone name"
                        />
                        <NumberInput
                          step="1"
                          value={editForm.max_orders}
                          onChange={(e) => setEditForm({ ...editForm, max_orders: e.target.value })}
                          placeholder="unlimited"
                          style={{ textAlign: 'right' }}
                          aria-label="Max orders"
                        />
                        <NumberInput
                          step="any"
                          value={editForm.min_price}
                          onChange={(e) => setEditForm({ ...editForm, min_price: e.target.value })}
                          placeholder="—"
                          style={{ textAlign: 'right' }}
                          aria-label="Min price"
                        />
                        <NumberInput
                          step="any"
                          value={editForm.max_price}
                          onChange={(e) => setEditForm({ ...editForm, max_price: e.target.value })}
                          placeholder="—"
                          style={{ textAlign: 'right' }}
                          aria-label="Max price"
                        />
                        <NumberInput
                          step="any"
                          value={editForm.range}
                          onChange={(e) => setEditForm({ ...editForm, range: e.target.value })}
                          placeholder="e.g. 2.00"
                          style={{ textAlign: 'right' }}
                          aria-label="Step"
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <IconButton label="Save" onClick={handleSaveEdit}>✓</IconButton>
                          <IconButton label="Cancel" onClick={handleCancelEdit}>✕</IconButton>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[length:var(--fs-body)]" style={{ ...CELL, fontWeight: 600 }}>{priceLabel(zone.name)}</div>
                        <div className="text-[length:var(--fs-body)]" style={{ ...CELL, textAlign: 'right' }}>{zone.max_orders != null ? zone.max_orders : '∞'}</div>
                        <div className="text-[length:var(--fs-body)]" style={{ ...CELL, textAlign: 'right' }}>{zone.min_price != null ? formatMoney(zone.min_price) : '-'}</div>
                        <div className="text-[length:var(--fs-body)]" style={{ ...CELL, textAlign: 'right' }}>{zone.max_price != null ? formatMoney(zone.max_price) : '-'}</div>
                        <div className="text-[length:var(--fs-body)]" style={{ ...CELL, textAlign: 'right' }}>{zone.range != null ? formatMoney(zone.range) : '-'}</div>
                        <div className="text-[length:var(--fs-body)]" style={{ ...CELL, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <IconButton label="Edit" onClick={() => handleEdit(zone)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </IconButton>
                          <IconButton label="Delete" danger onClick={() => handleDelete(zone.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </IconButton>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

            </div>
          </>
        )}
        </div>

        <div
          className={`${MODAL_FOOTER} flex flex-wrap items-center`}
          style={{ gap: 8, marginTop: 12, borderTop: '1px solid var(--color-hairline)', paddingTop: 12 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              handleCreate();
            }
          }}
        >
          <div
            className="grid flex-1 min-w-0 gap-2 grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] max-[1023px]:basis-full"
          >
            <TextInput
              type="text"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="Zone name"
              aria-label="New zone name"
            />
            <NumberInput
              step="1"
              value={newForm.max_orders}
              onChange={(e) => setNewForm({ ...newForm, max_orders: e.target.value })}
              placeholder="unlimited"
              style={{ textAlign: 'right' }}
              aria-label="New zone max orders"
            />
            <NumberInput
              step="any"
              value={newForm.min_price}
              onChange={(e) => setNewForm({ ...newForm, min_price: e.target.value })}
              placeholder="min"
              style={{ textAlign: 'right' }}
              aria-label="New zone min price"
            />
            <NumberInput
              step="any"
              value={newForm.max_price}
              onChange={(e) => setNewForm({ ...newForm, max_price: e.target.value })}
              placeholder="max"
              style={{ textAlign: 'right' }}
              aria-label="New zone max price"
            />
            <NumberInput
              step="any"
              value={newForm.range}
              onChange={(e) => setNewForm({ ...newForm, range: e.target.value })}
              placeholder="step"
              style={{ textAlign: 'right' }}
              aria-label="New zone step"
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center max-[1023px]:w-full max-[1023px]:justify-end" style={{ gap: 8 }}>
            <button
              onClick={handleCreate}
              className="shrink-0 text-[length:var(--fs-label)] transition-opacity hover:opacity-90"
              style={{ ...BTN, background: 'var(--color-ink)', color: 'var(--color-canvas)' }}
              title="Add zone"
              aria-label="Add zone"
            >
              Add zone
            </button>
            <button onClick={onClose} style={BTN_SECONDARY} className="shrink-0 text-[length:var(--fs-label)] transition-colors hover:bg-surface-soft">
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
