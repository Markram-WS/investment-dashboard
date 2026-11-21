import React, { useState } from 'react';
import { api } from '../../lib/api';
import ModalShell from './ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './modalLayout';
import {
  CONTROL_TITLE, CONTROL_LABEL, CONTROL_VALUE, CONTROL_INPUT, CONTROL_HELPER,
  CONTROL_BUTTON_PRIMARY, CONTROL_BUTTON_SECONDARY,
} from './controlStyles';
import { formatMoney } from '../../utils/format';

interface TransferModalProps {
  open: boolean;
  source: { id: number; name: string; available: number };
  destination: { id: number; name: string };
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const CARD = {
  background: 'var(--color-canvas)',
  borderRadius: 'var(--rounded-xl)',
  padding: 'var(--space-md)',
} as const;

const TransferModal: React.FC<TransferModalProps> = ({ open, source, destination, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const num = parseFloat(amount);

  const handleMax = () => setAmount(String(source.available));

  const handleConfirm = async () => {
    if (isNaN(num) || num <= 0) { setError('Please enter a valid amount'); return; }
    if (num > source.available) { setError(`Maximum transfer is ${formatMoney(source.available)}`); return; }
    setLoading(true);
    setError('');
    try {
      const transfer = await api.createTransfer({
        source_portfolio_id: source.id,
        destination_portfolio_id: destination.id,
        amount: num,
      });
      await api.confirmTransfer(transfer.transaction_id, "auto-confirm");
      onSuccess(`Transferred ${formatMoney(num)} from ${source.name} → ${destination.name}`);
      onClose();
    } catch (e: unknown) {
      console.error("Failed to transfer cash:", e);
      setError("Couldn't transfer cash.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Transfer cash" zIndex={9999}>
      <div className={`${MODAL_CARD} w-full max-w-[400px] mx-4`} style={CARD}>
        <h3 className={MODAL_HEADER} style={CONTROL_TITLE}>Transfer cash</h3>

        <div className={MODAL_BODY}>
          <div style={{ marginBottom: 20, marginTop: 24 }}>
            <div style={CONTROL_LABEL}>From</div>
            <div style={CONTROL_VALUE}>{source.name}</div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={CONTROL_LABEL}>To</div>
            <div style={CONTROL_VALUE}>{destination.name}</div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={CONTROL_LABEL}>Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                step={100}
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1"
                style={CONTROL_INPUT}
              />
              <button
                onClick={handleMax}
                className="rounded-full hover:bg-surface-soft transition-colors"
                style={CONTROL_BUTTON_SECONDARY}
              >
                Max
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={CONTROL_HELPER}>
              Available: <strong style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(source.available)}</strong>
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--color-danger-text)',
                background: 'var(--color-coral-light)', borderRadius: 'var(--rounded-md)',
                padding: 'var(--space-xs) var(--space-sm)', marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className={`${MODAL_FOOTER} flex gap-3 justify-end`} style={{ marginTop: 12 }}>
          <button onClick={onClose} disabled={loading} style={CONTROL_BUTTON_SECONDARY}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={CONTROL_BUTTON_PRIMARY}
          >
            Confirm →
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
;

export default TransferModal;
