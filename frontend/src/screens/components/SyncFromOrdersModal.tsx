import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AssetSyncChoice } from '../../types';
import ModalShell from './ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './modalLayout';
import { CONTROL_BUTTON_PRIMARY, CONTROL_BUTTON_SECONDARY, CONTROL_HELPER, CONTROL_INPUT, CONTROL_TITLE } from './controlStyles';
import { apiErrorDetail } from './apiError';

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

export default function SyncFromOrdersModal({ open, onClose, onApplied }: SyncFromOrdersModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
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
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const items = data?.items ?? [];
  const selectedCount = items.filter((item) => {
    const key = `${item.broker_id ?? 'none'}:${item.symbol}`;
    return Boolean(selections[key]);
  }).length;

  const handleApply = async () => {
    const choices: AssetSyncChoice[] = [];
    for (const item of items) {
      const key = `${item.broker_id ?? 'none'}:${item.symbol}`;
      const selection = selections[key];
      if (!selection) continue;
      if (selection === 'create') {
        choices.push({ symbol: item.symbol, broker_id: item.broker_id, create_product: true });
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
                  const key = `${item.broker_id ?? 'none'}:${item.symbol}`;
                  const value = selections[key] ?? '';
                  return (
                    <tr key={key}>
                      <td style={{ ...cell, fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
                        {item.symbol}
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
                              <option value="create">
                                Create new — {item.create.ticker ?? item.symbol} (sync {item.create.sync_symbol})
                              </option>
                            </select>
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
            <button type="button" onClick={handleApply} disabled={applying || selectedCount === 0}
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
