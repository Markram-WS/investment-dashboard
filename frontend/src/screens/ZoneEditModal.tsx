import React from 'react';
import { SpreadOrder } from './types';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">Edit Zone: {zone}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Zone Name</label>
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
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
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
    </div>
  );
};