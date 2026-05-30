import { useState } from 'react';

interface SpreadOrder {
  order_id: number;
  asset_type: string;
  side: string;
  qty: number | string;
  entry_price: number | null;
  current_price: number | null;
  tp_price: number | null;
  leverage: number | null;
  margin_rate: number | null;
  order_status: string;
  executed_by: string;
  created_at: string | null;
  spread_pair_id: string | null;
  zone: string | null;
}

interface UseOrderEditReturn {
  editingOrder: SpreadOrder | null;
  formData: Partial<SpreadOrder>;
  showModal: boolean;
  startEdit: (order: SpreadOrder) => void;
  closeModal: () => void;
  handleFormChange: (field: keyof Partial<SpreadOrder>, value: any) => void;
  handleSaveOrder: () => Promise<boolean>;
}

export const useOrderEdit = (): UseOrderEditReturn => {
  const [editingOrder, setEditingOrder] = useState<SpreadOrder | null>(null);
  const [formData, setFormData] = useState<Partial<SpreadOrder>>({});
  const [showModal, setShowModal] = useState(false);

  const startEdit = (order: SpreadOrder) => {
    setEditingOrder(order);
    setFormData({
      asset_type: order.asset_type,
      side: order.side,
      qty: order.qty,
      entry_price: order.entry_price,
      tp_price: order.tp_price,
      zone: order.zone,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    setFormData({});
  };

  const handleFormChange = (field: keyof Partial<SpreadOrder>, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveOrder = async (): Promise<boolean> => {
    if (!editingOrder) return false;

    try {
      const response = await fetch(`/api/v1/orders/${editingOrder.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order: ${response.statusText}`);
      }

      closeModal();
      return true;
    } catch (error) {
      console.error('Error saving order:', error);
      return false;
    }
  };

  return {
    editingOrder,
    formData,
    showModal,
    startEdit,
    closeModal,
    handleFormChange,
    handleSaveOrder,
  };
};