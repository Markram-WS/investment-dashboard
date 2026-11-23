import React, { useState, useEffect, useRef } from 'react';
import { api, type AssetGroupRecord } from '../lib/api';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import IconButton from '../components/IconButton';
import { TextInput } from './components/Field';
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_TITLE,
} from './components/controlStyles';

interface AssetGroupModalProps {
  open: boolean;
  onClose: () => void;
}

const DUPLICATE_NAME = 'A group with this name already exists.';
const SAVE_FAILED = "Couldn't save the group. Try again.";
const DELETE_FAILED = "Couldn't delete the group. Try again.";

/** Group row: name (with badge) and a fixed action column. */
const GRID_ROW = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 64px',
  columnGap: 8,
  alignItems: 'center',
  minHeight: 32,
} as const;

const nameCell = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
} as const;

const nameText = {
  fontSize: 'var(--fs-label)',
  color: 'var(--color-ink)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** Badge: 10px/500 slate on surface-soft, pill radius. */
const badgeStyle = {
  flexShrink: 0,
  fontSize: 'var(--fs-micro)',
  fontWeight: 500,
  color: 'var(--color-slate)',
  background: 'var(--color-surface-soft)',
  borderRadius: 999,
  padding: '1px 7px',
  whiteSpace: 'nowrap',
} as const;

const countStyle = {
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  color: 'var(--color-slate)',
} as const;

const errorLine = {
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  color: 'var(--color-danger-text)',
  lineHeight: 1.4,
  margin: 0,
} as const;

const primaryButton = CONTROL_BUTTON_PRIMARY;
const secondaryButton = CONTROL_BUTTON_SECONDARY;
const actionButtonClass = 'shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed';

const modalPanel = 'bg-canvas border border-hairline w-full max-w-xl';
const modalPanelStyle = {
  padding: 'var(--space-md)',
  borderRadius: 'var(--rounded-xl)',
} as const;

/** Raw error text: the API body (fastapi detail) or the Error message. */
const errorText = (err: unknown): string => {
  if (typeof err === 'object' && err !== null && 'body' in err && typeof err.body === 'string' && err.body !== '') {
    return err.body;
  }
  return err instanceof Error ? err.message : '';
};

const AssetGroupModal: React.FC<AssetGroupModalProps> = ({ open, onClose }) => {
  const [groups, setGroups] = useState<AssetGroupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newName, setNewName] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [footerError, setFooterError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newGroupRef = useRef<HTMLInputElement>(null);

  const fetchGroups = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getAssetGroups();
      setGroups(data);
    } catch (err) {
      console.error('Failed to load asset groups', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setFooterError(null);
    setRowError(null);
    setEditingId(null);
    setEditingName('');
    fetchGroups();
    // Focus the new-group field once ModalShell has run its own initial focus.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => newGroupRef.current?.focus());
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner !== 0) cancelAnimationFrame(inner);
    };
  }, [open]);

  // Entering edit mode: fill the row input and select the name for replacement.
  useEffect(() => {
    if (editingId === null) return;
    const frame = requestAnimationFrame(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setRowError(null);
  };

  const handleEdit = (group: AssetGroupRecord) => {
    setFooterError(null);
    setRowError(null);
    setEditingName(group.name);
    setEditingId(group.id);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this group? Assets will be ungrouped.')) return;
    setFooterError(null);
    try {
      await api.deleteAssetGroup(id);
      await fetchGroups(true);
      if (editingId === id) cancelEdit();
    } catch (err) {
      console.error('Failed to delete the group', err);
      setFooterError(DELETE_FAILED);
    }
  };

  const handleSaveEdit = async () => {
    if (editingId === null || savingEdit) return;
    const name = editingName.trim();
    if (!name) return;
    setRowError(null);
    setSavingEdit(true);
    try {
      await api.updateAssetGroup(editingId, { name });
      setEditingId(null);
      setEditingName('');
      await fetchGroups(true);
    } catch (err) {
      console.error('Failed to save the group', err);
      setRowError(/already exists/i.test(errorText(err)) ? DUPLICATE_NAME : SAVE_FAILED);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    const name = newName.trim();
    if (!name) return;
    setFooterError(null);
    setCreating(true);
    try {
      await api.createAssetGroup({ name });
      setNewName('');
      await fetchGroups(true);
      requestAnimationFrame(() => newGroupRef.current?.focus());
    } catch (err) {
      console.error('Failed to create the group', err);
      setFooterError(/already exists/i.test(errorText(err)) ? DUPLICATE_NAME : SAVE_FAILED);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} title="Asset groups">
      <div className={`${MODAL_CARD} ${modalPanel}`} style={modalPanelStyle}>
        <div className={`${MODAL_HEADER} flex items-center justify-between`} style={{ marginBottom: 12 }}>
          <div className="flex items-baseline" style={{ gap: 8 }}>
            <h3 style={CONTROL_TITLE}>Asset groups</h3>
            <span style={countStyle}>{groups.length === 1 ? '1 group' : `${groups.length} groups`}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl text-slate hover:text-ink leading-none"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <div className={MODAL_BODY}>
          {loading && groups.length === 0 ? (
            <div className="animate-pulse" aria-hidden="true">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex items-center"
                  style={{
                    height: 32,
                    gap: 8,
                    borderTop: row === 0 ? undefined : '1px solid var(--color-hairline-soft)',
                  }}
                >
                  <div className="h-3 bg-surface rounded w-40" />
                  <div className="ml-auto h-3 bg-surface rounded w-12" />
                  <div className="h-3 bg-surface rounded w-10" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {groups.length === 0 && (
                <p style={{ ...nameText, color: 'var(--color-slate)', margin: '4px 0' }}>
                  No groups yet.
                </p>
              )}
              {groups.map((group) => {
                const isEditing = editingId === group.id;
                return (
                  <div key={group.id}>
                    <div
                      data-group-id={group.id}
                      data-default={group.is_default ? 'true' : undefined}
                      style={{
                        ...GRID_ROW,
                        borderTop: '1px solid var(--color-hairline-soft)',
                      }}
                      onKeyDown={(e) => {
                        if (!isEditing) return;
                        if (e.key === 'Enter') {
                          if (e.target instanceof HTMLButtonElement) return;
                          e.preventDefault();
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelEdit();
                        }
                      }}
                    >
                      {isEditing ? (
                        <TextInput
                          ref={editInputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          aria-label={`Rename ${group.name}`}
                        />
                      ) : (
                        <div style={nameCell}>
                          <span
                            style={{
                              ...nameText,
                              fontWeight: group.is_default ? 400 : 600,
                            }}
                          >
                            {group.name}
                          </span>
                          {group.is_default && <span style={badgeStyle}>default</span>}
                        </div>
                      )}
                      <div className="flex items-center justify-end" style={{ gap: 4 }}>
                        {isEditing ? (
                          <>
                            <IconButton
                              label="Save"
                              onClick={handleSaveEdit}
                              disabled={savingEdit || !editingName.trim()}
                            >
                              &#10003;
                            </IconButton>
                            <IconButton label="Cancel" onClick={cancelEdit}>
                              &#10005;
                            </IconButton>
                          </>
                        ) : (
                          !group.is_default && (
                            <>
                              <IconButton label="Edit" onClick={() => handleEdit(group)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </IconButton>
                              <IconButton label="Delete" danger onClick={() => handleDelete(group.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </IconButton>
                            </>
                          )
                        )}
                      </div>
                    </div>
                    {isEditing && rowError && (
                      <p role="alert" style={{ ...errorLine, padding: '2px 0 6px' }}>
                        {rowError}
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div
          className={MODAL_FOOTER}
          style={{ marginTop: 12, borderTop: '1px solid var(--color-hairline)', paddingTop: 12 }}
        >
          {footerError && (
            <p role="alert" style={{ ...errorLine, marginBottom: 8 }}>
              {footerError}
            </p>
          )}
          <div className="flex items-center" style={{ gap: 8 }}>
            <div className="flex-1 min-w-0">
              <TextInput
                ref={newGroupRef}
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (footerError) setFooterError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="New group name"
                aria-label="New group name"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className={actionButtonClass}
              style={primaryButton}
            >
              Add group
            </button>
            <button type="button" onClick={onClose} style={secondaryButton} className="shrink-0">
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default AssetGroupModal;
