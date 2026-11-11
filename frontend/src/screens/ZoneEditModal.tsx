import React from 'react';
import type { CSSProperties } from 'react';
import { SpreadOrder } from '../types';
import ModalShell from './components/ModalShell';

interface ZoneEditModalProps {
  orders: SpreadOrder[];
  zone: string;
  showModal: boolean;
  onClose: () => void;
  onSave: (newZone: string) => Promise<void>;
}

const CARD: CSSProperties = { background: 'var(--color-canvas)', borderRadius: 16, padding: 24 };
const TITLE: CSSProperties = {
  fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0,
};
const LABEL: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-slate)', margin: '0 0 6px',
};
const INPUT: CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 15, fontWeight: 500,
  color: 'var(--color-ink)', background: 'transparent',
  borderRadius: 8,
};
const BTN: CSSProperties = {
  fontSize: 12, fontWeight: 500, borderRadius: 999, padding: '6px 14px',
  border: '1px solid transparent', cursor: 'pointer',
};
const BTN_PRIMARY: CSSProperties = {
  ...BTN, background: 'var(--color-ink)', color: 'var(--color-canvas)',
};
const BTN_SECONDARY: CSSProperties = {
  ...BTN, background: 'transparent', color: 'var(--color-ink)', borderColor: 'var(--color-hairline)',
};

export const ZoneEditModal: React.FC<ZoneEditModalProps> = ({
  orders,
  zone,
  showModal,
  onClose,
  onSave,
}) => {
  const [newZone, setNewZone] = React.useState(zone);
  
  React.useEffect(() => {
    setNewZone(zone);
  }, [zone]);

  if (!showModal) return null;

  return (
    <ModalShell open={showModal} onClose={onClose} title={"Edit zone: " + zone} closeOnBackdrop={false}>
      <div className="w-full max-w-md mx-4" style={CARD}>
        <h3 style={{ ...TITLE, marginBottom: 16 }}>Edit zone: {zone}</h3>
        <div className="flex flex-col" style={{ gap: 16 }}>
          <div>
            <label style={LABEL}>Zone name</label>
            <input
              type="text"
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
              className="border border-hairline focus:border-brand-teal"
              style={INPUT}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2" style={{ marginTop: 24 }}>
          <button onClick={onClose} style={BTN_SECONDARY} className="transition-colors hover:bg-surface-soft">
            Cancel
          </button>
          <button onClick={() => onSave(newZone)} style={BTN_PRIMARY} className="transition-opacity hover:opacity-90">
            Save changes
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
