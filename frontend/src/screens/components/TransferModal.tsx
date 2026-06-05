import React, { useState } from 'react';
import { api } from '../../lib/api';
import Button from './Button';

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
      if (transfer.confirmation_token) {
        await api.confirmTransfer(transfer.transaction_id, transfer.confirmation_token);
      }
      onSuccess(`Transferred $${num.toLocaleString()} from ${source.name} → ${destination.name}`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 20, padding: 32,
        width: 400, maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', color: '#1c1c1e' }}>
          Transfer Cash
        </h3>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#555a6a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>From</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1e' }}>{source.name}</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#555a6a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>To</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1e' }}>{destination.name}</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#555a6a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>Amount</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              step={100}
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e2e8',
                fontSize: 16, fontWeight: 600, color: '#1c1c1e', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#0fbcb0'}
              onBlur={e => e.target.style.borderColor = '#e0e2e8'}
            />
            <Button variant="ghost" size="sm" onClick={handleMax}>Max</Button>
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#555a6a', marginBottom: 20 }}>
          Available: <strong style={{ color: '#1c1c1e' }}>${source.available.toLocaleString()}</strong>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: '#ba1a1a', background: '#ffdad6', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} loading={loading}>Confirm →</Button>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
