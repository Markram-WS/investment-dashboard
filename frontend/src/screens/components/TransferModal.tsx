import React, { useState } from 'react';
import { api } from '../../lib/api';
import ModalShell from './ModalShell';

interface TransferModalProps {
  open: boolean;
  source: { id: number; name: string; available: number };
  destination: { id: number; name: string };
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const CARD = { background: 'var(--color-canvas)', borderRadius: 16, padding: 24 } as const;
const TITLE = {
  fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0,
} as const;
const LABEL = { fontSize: 12, fontWeight: 500, color: 'var(--color-slate)', margin: 0 } as const;
const VALUE = {
  fontSize: 15, fontWeight: 500, color: 'var(--color-ink)', margin: '6px 0 0',
} as const;
const HELPER = { fontSize: 12, fontWeight: 400, color: 'var(--color-slate)', margin: 0 } as const;
const INPUT = {
  width: '100%', padding: '8px 12px', fontSize: 15, fontWeight: 500,
  fontVariantNumeric: 'tabular-nums', color: 'var(--color-ink)', background: 'transparent',
  borderRadius: 8,
} as const;
const BTN = {
  fontSize: 12, fontWeight: 500, borderRadius: 999, padding: '6px 14px',
  border: '1px solid transparent', cursor: 'pointer',
} as const;
const BTN_PRIMARY = { ...BTN, background: 'var(--color-ink)', color: 'var(--color-canvas)' } as const;
const BTN_SECONDARY = {
  ...BTN, background: 'transparent', color: 'var(--color-ink)', borderColor: 'var(--color-hairline)',
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
    if (num > source.available) { setError(`Maximum transfer is $${source.available.toLocaleString()}`); return; }
    setLoading(true);
    setError('');
    try {
      const transfer = await api.createTransfer({
        source_portfolio_id: source.id,
        destination_portfolio_id: destination.id,
        amount: num,
      });
      await api.confirmTransfer(transfer.transaction_id, "auto-confirm");
      onSuccess(`Transferred $${num.toLocaleString()} from ${source.name} → ${destination.name}`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Transfer cash" zIndex={9999}>
      <div className="w-full max-w-[400px] mx-4" style={CARD}>
        <h3 style={TITLE}>Transfer cash</h3>

        <div style={{ marginBottom: 20, marginTop: 24 }}>
          <div style={LABEL}>From</div>
          <div style={VALUE}>{source.name}</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={LABEL}>To</div>
          <div style={VALUE}>{destination.name}</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              step={100}
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 border border-hairline focus:border-brand-teal"
              style={INPUT}
            />
            <button
              onClick={handleMax}
              className="rounded-full hover:bg-surface-soft transition-colors"
              style={BTN_SECONDARY}
            >
              Max
            </button>
          </div>
        </div>

        <div style={{ ...HELPER, marginBottom: 20 }}>
          Available: <strong style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>${source.available.toLocaleString()}</strong>
        </div>

        {error && (
          <div
            style={{
              fontSize: 12, fontWeight: 500, color: 'var(--color-danger-text)',
              background: 'var(--color-coral-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} style={BTN_SECONDARY}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={BTN_PRIMARY}
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
