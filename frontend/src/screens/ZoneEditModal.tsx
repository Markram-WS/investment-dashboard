import React from 'react';
import { SpreadOrder } from '../types';
import ModalShell from './components/ModalShell';

interface ZoneEditModalProps {
  orders: SpreadOrder[];
  zone: string;
  showModal: boolean;
  onClose: () => void;
  onSave: (newZone: string) => Promise<void>;
}

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
    <ModalShell open={showModal} onClose={onClose} title={"Edit Zone: " + zone} closeOnBackdrop={false}>
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">Edit Zone: {zone}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate mb-1">Zone Name</label>
            <input
              type="text"
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(newZone)}
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </ModalShell>
  );
};