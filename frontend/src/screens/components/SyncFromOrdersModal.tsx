import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AssetSyncChoice, SyncProposalItem } from '../../types';
import ModalShell from './ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './modalLayout';
import { CONTROL_BUTTON_PRIMARY, CONTROL_BUTTON_SECONDARY, CONTROL_HELPER, CONTROL_INPUT, CONTROL_LABEL, CONTROL_TITLE } from './controlStyles';
import { apiErrorDetail } from './apiError';

type CreateAssetType = 'stock' | 'future' | 'option' | 'crypto';
type CreateSource = 'yfinance' | 'tfex' | 'manual';

interface CreateDraft {
  underlying: string;
  assetType: '' | CreateAssetType;
  source: '' | CreateSource;
  syncSymbol: string;
}

const EMPTY_CREATE_DRAFT: CreateDraft = { underlying: '', assetType: '', source: '', syncSymbol: '' };
const ASSET_TYPE_OPTIONS: CreateAssetType[] = ['stock', 'future', 'option', 'crypto'];
const SOURCE_OPTIONS: { value: CreateSource; label: string }[] = [
  { value: 'yfinance', label: 'yfinance (Yahoo Finance)' },
  { value: 'tfex', label: 'tfex (TFEX)' },
  { value: 'manual', label: 'manual (no feed)' },
];

function joinList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

/** Why this create row cannot be submitted yet, or null when it is complete. */
function incompleteCreateReason(item: SyncProposalItem, draft: CreateDraft): string | null {
  const missing: string[] = [];
  if (!draft.source) missing.push('a price source');
  if (draft.source !== 'manual' && !draft.syncSymbol.trim()) missing.push('a provider symbol');
  if (missing.length === 0) return null;
  return `${item.symbol} still needs ${joinList(missing)} before Apply.`;
}

interface SyncFromOrdersModalProps {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

const errorText = {
  color: 'var(--color-danger-text)',
  background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)',
  borderRadius: 8,
  padding: '6px 8px',
  marginBottom: 8,
} as const;

const cell = {
  fontSize: 'var(--fs-label)',
  padding: '4px 8px',
  borderBottom: '1px solid var(--color-hairline)',
  verticalAlign: 'top',
} as const;

const headCell = {
  ...cell,
  fontSize: 'var(--fs-micro)',
  fontWeight: 500,
  color: 'var(--color-slate)',
  whiteSpace: 'nowrap',
} as const;

/** Neutral "has spec" chip: 11px slate on surface-soft with a hairline edge. */
const specChipStyle = {
  marginLeft: 6,
  fontSize: 'var(--fs-label)',
  fontWeight: 500,
  color: 'var(--color-slate)',
  background: 'var(--color-surface-soft)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--rounded-full)',
  padding: '0 6px',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
} as const;

export default function SyncFromOrdersModal({ open, onClose, onApplied }: SyncFromOrdersModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, CreateDraft>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['asset-sync-proposal', open],
    queryFn: () => api.getAssetProposal(),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelections({});
      setDrafts({});
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const items = data?.items ?? [];
  const rowKey = (item: SyncProposalItem) => `${item.broker_id ?? 'none'}:${item.symbol}`;
  const draftFor = (key: string): CreateDraft => drafts[key] ?? EMPTY_CREATE_DRAFT;
  const rememberDraft = (key: string, patch: Partial<CreateDraft>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_CREATE_DRAFT), ...patch } }));

  const selectedCount = items.filter((item) => Boolean(selections[rowKey(item)])).length;

  let firstIncomplete: { key: string; reason: string } | null = null;
  for (const item of items) {
    const key = rowKey(item);
    if (selections[key] !== 'create') continue;
    const reason = incompleteCreateReason(item, draftFor(key));
    if (reason) {
      firstIncomplete = { key, reason };
      break;
    }
  }

  const handleApply = async () => {
    const choices: AssetSyncChoice[] = [];
    for (const item of items) {
      const key = rowKey(item);
      const selection = selections[key];
      if (!selection) continue;
      if (selection === 'create') {
        const draft = draftFor(key);
        const reason = incompleteCreateReason(item, draft);
        if (reason) {
          setError(reason);
          return;
        }
        choices.push({
          symbol: item.symbol,
          broker_id: item.broker_id,
          create_product: true,
          create_source: draft.source as CreateSource,
          ...(draft.assetType ? { create_asset_type: draft.assetType } : {}),
          create_sync_symbol: draft.source === 'manual' ? '' : draft.syncSymbol.trim(),
          create_underlying: draft.underlying.trim(),
        });
      } else {
        choices.push({
          symbol: item.symbol,
          broker_id: item.broker_id,
          product_id: Number(selection.replace('product:', '')),
        });
      }
    }
    if (choices.length === 0) {
      setError('Choose a product or “create new” for at least one symbol.');
      return;
    }
    setApplying(true);
    setError('');
    try {
      await api.applyAssetProposal(choices);
      onApplied();
      onClose();
    } catch (e) {
      console.error('Failed to apply the asset proposal', e);
      setError(apiErrorDetail(e, "Couldn't apply the selection."));
    } finally {
      setApplying(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Sync from orders" zIndex={9999}>
      <div className={`${MODAL_CARD} bg-canvas border border-hairline w-full max-w-[760px] mx-4`}
        style={{ padding: 'var(--space-md)', borderRadius: 'var(--rounded-xl)' }}>
        <h3 className={`${MODAL_HEADER} block`} style={{ ...CONTROL_TITLE, margin: '0 0 8px' }}>
          Sync from orders
        </h3>

        <div className={MODAL_BODY}>
          <p style={{ ...CONTROL_HELPER, margin: '0 0 10px' }}>
            Every distinct order symbol from main, custom and mapped portfolios is listed below,
            including symbols that already have a contract spec. Choose a same-broker product,
            reassign a row, or create a new product; nothing is written until Apply.
          </p>

          {error && <div style={errorText} className="text-[length:var(--fs-label)]">{error}</div>}

          <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headCell}>Symbol</th>
                  <th style={headCell}>Broker</th>
                  <th style={{ ...headCell, width: '52%' }}>Assign to</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={3} style={{ ...cell, color: 'var(--color-slate)' }}>Loading proposal…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={3} style={{ ...cell, color: 'var(--color-slate)' }}>
                    No order symbols found in any portfolio. Add an order, then come back to assign
                    contract specs.
                  </td></tr>
                ) : items.map((item) => {
                  const key = rowKey(item);
                  const value = selections[key] ?? '';
                  const draft = draftFor(key);
                  return (
                    <tr key={key}>
                      <td style={{ ...cell, fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
                        {item.symbol}
                        {item.resolved && (
                          <span
                            style={specChipStyle}
                            title="Already has a contract spec"
                            aria-label="Already has a contract spec"
                          >
                            has spec
                          </span>
                        )}
                      </td>
                      <td style={{ ...cell, color: 'var(--color-slate)', whiteSpace: 'nowrap' }}>
                        {item.broker_code ?? 'Unassigned'}
                      </td>
                      <td style={cell}>
                        {item.broker_required ? (
                          <span style={{ color: 'var(--color-danger-text)' }}>
                            Assign a broker in Edit portfolio before adding orders
                          </span>
                        ) : (
                          <>
                            <select
                              aria-label={`Assign ${item.symbol}`}
                              value={value}
                              onChange={(e) => setSelections(prev => ({ ...prev, [key]: e.target.value }))}
                              style={CONTROL_INPUT}
                            >
                              <option value="">Select…</option>
                              {item.products.length > 0 && (
                                <optgroup label="Same-broker products">
                                  {item.products.map((product) => (
                                    <option key={product.product_id} value={`product:${product.product_id}`}>
                                      {product.ticker ?? '—'} · {product.asset_type ?? '—'} ·{' '}
                                      {product.symbol_count} symbol{product.symbol_count === 1 ? '' : 's'}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <option value="create">Create new — {item.create.symbol}</option>
                            </select>
                            {value === 'create' && (
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: '8px 10px',
                                  border: '1px solid var(--color-hairline)',
                                  borderRadius: 8,
                                  display: 'grid',
                                  gap: 8,
                                }}
                              >
                                {item.order_asset_types.length > 0 && (
                                  <span style={{ ...CONTROL_HELPER, margin: 0 }}>
                                    Orders behind this pair recorded {joinList(item.order_asset_types)} — a hint, not a default.
                                  </span>
                                )}
                                <span style={{ ...CONTROL_HELPER, margin: 0 }}>
                                  An order stores only the symbol, so the dashboard cannot tell whether it is a TFEX series or a Thai stock.
                                </span>
                                <span style={{ ...CONTROL_HELPER, margin: 0 }}>
                                  Pick the underlying if the contract has one, then the source, the provider key and the asset type — PTT.BK for a THB stock on Yahoo,
                                  S50Z26 for TFEX, or manual when there is no feed.
                                </span>
                                <span style={{ ...CONTROL_HELPER, margin: 0 }}>
                                  A wrong key still saves the row, but its price stays empty until you edit it in All-assets;
                                  a manual product is never fetched.
                                </span>
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                    gap: 8,
                                  }}
                                >
                                  <label style={{ gridColumn: '1 / -1' }}>
                                    <span style={CONTROL_LABEL}>Underlying</span>
                                    <input
                                      type="text"
                                      aria-label={`Underlying for ${item.symbol}`}
                                      value={draft.underlying}
                                      placeholder="e.g. S50, or leave blank"
                                      onChange={(e) => rememberDraft(key, { underlying: e.target.value })}
                                      style={CONTROL_INPUT}
                                    />
                                    <span style={{ ...CONTROL_HELPER, display: 'block' }}>
                                      Empty = use the identity with no underlying; the row's broker still applies.
                                    </span>
                                  </label>
                                  <label>
                                    <span style={CONTROL_LABEL}>Asset type</span>
                                    <select
                                      aria-label={`Asset type for ${item.symbol}`}
                                      value={draft.assetType}
                                      onChange={(e) =>
                                        rememberDraft(key, { assetType: e.target.value as CreateDraft['assetType'] })}
                                      style={CONTROL_INPUT}
                                    >
                                      <option value="">No type — default identity</option>
                                      {ASSET_TYPE_OPTIONS.map((assetType) => (
                                        <option key={assetType} value={assetType}>{assetType}</option>
                                      ))}
                                    </select>
                                    {!draft.assetType && (
                                      <span style={{ ...CONTROL_HELPER, display: 'block' }}>
                                        No type means the price symbol gets no type of its own: it joins the identity with this row's underlying (or none)
                                        and broker, and inherits that identity's multiplier, margin and price source — a brand-new default identity is multiplier 1, margin 0 and no feed.
                                      </span>
                                    )}
                                  </label>
                                  <label>
                                    <span style={CONTROL_LABEL}>Price source</span>
                                    <select
                                      aria-label={`Price source for ${item.symbol}`}
                                      value={draft.source}
                                      onChange={(e) =>
                                        rememberDraft(key, { source: e.target.value as CreateDraft['source'] })}
                                      style={CONTROL_INPUT}
                                    >
                                      <option value="">Choose…</option>
                                      {SOURCE_OPTIONS.map((source) => (
                                        <option key={source.value} value={source.value}>{source.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label style={{ gridColumn: '1 / -1' }}>
                                    <span style={CONTROL_LABEL}>Provider symbol</span>
                                    <input
                                      type="text"
                                      aria-label={`Provider symbol for ${item.symbol}`}
                                      value={draft.source === 'manual' ? '' : draft.syncSymbol}
                                      disabled={draft.source === 'manual'}
                                      placeholder={draft.source === 'tfex' ? 'e.g. S50Z26' : 'e.g. PTT.BK'}
                                      onChange={(e) => rememberDraft(key, { syncSymbol: e.target.value })}
                                      style={{
                                        ...CONTROL_INPUT,
                                        ...(draft.source === 'manual' ? { opacity: 0.55, cursor: 'not-allowed' } : null),
                                      }}
                                    />
                                    {draft.source === 'manual' && (
                                      <span style={{ ...CONTROL_HELPER, display: 'block' }}>
                                        Manual products keep the dashboard key and fetch nothing
                                      </span>
                                    )}
                                  </label>
                                </div>
                                {firstIncomplete?.key === key && (
                                  <span style={{ ...CONTROL_HELPER, margin: 0, color: 'var(--color-danger-text)' }}>
                                    {firstIncomplete.reason}
                                  </span>
                                )}
                              </div>
                            )}
                            <span style={{ ...CONTROL_HELPER, display: 'block', marginTop: 2 }}>
                              {item.products.length} same-broker product{item.products.length === 1 ? '' : 's'}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${MODAL_FOOTER} flex justify-between items-center`} style={{ gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => refetch()} style={CONTROL_BUTTON_SECONDARY}>
            Refresh proposal
          </button>
          <div className="flex" style={{ gap: 8 }}>
            <button type="button" onClick={onClose} style={CONTROL_BUTTON_SECONDARY}>Cancel</button>
            <button type="button" onClick={handleApply}
              disabled={applying || selectedCount === 0 || firstIncomplete !== null}
              style={CONTROL_BUTTON_PRIMARY}
              className="transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
              {applying ? 'Applying…' : `Apply ${selectedCount || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
