import React, { useState } from 'react';
import { api } from '../../lib/api';
import Button from './Button';
import ModalShell from './ModalShell';

interface TransferModalProps {
  open: boolean;
  source: { id: number; name: string; available: number };
  destination: { id: number; name: string };
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

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
    <ModalShell open={open} onClose={onClose} title="Transfer Cash" backdropClassName="bg-black/40" zIndex={9999}>
      <div className="bg-canvas rounded-[20px] p-8 w-[400px] max-w-[90vw] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <h3 className="text-lg font-bold m-0 mb-6 text-ink">
          Transfer Cash
        </h3>

        <div className="mb-5">
          <div className="text-xs text-slate font-semibold uppercase tracking-wide mb-1">From</div>
          <div className="text-[15px] font-semibold text-ink">{source.name}</div>
        </div>

        <div className="mb-6">
          <div className="text-xs text-slate font-semibold uppercase tracking-wide mb-1">To</div>
          <div className="text-[15px] font-semibold text-ink">{destination.name}</div>
        </div>

        <div className="mb-2">
          <label className="text-xs text-slate font-semibold uppercase tracking-wide mb-1.5 block">Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              step={100}
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-hairline text-base font-semibold text-ink outline-none focus:border-brand-teal"
            />
            <Button variant="ghost" size="sm" onClick={handleMax}>Max</Button>
          </div>
        </div>

        <div className="text-[11px] text-slate mb-5">
          Available: <strong className="text-ink">${source.available.toLocaleString()}</strong>
        </div>

        {error && (
          <div className="text-xs text-[#ba1a1a] bg-[#ffdad6] px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

                <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} loading={loading}>Confirm →</Button>
        </div>
      </div>
    </ModalShell>
  );
}
;

export default TransferModal;
