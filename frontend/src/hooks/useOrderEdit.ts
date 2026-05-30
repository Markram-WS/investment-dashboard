import { useState, useCallback, useRef } from 'react';

interface SpreadOrder {
  order_id: number;
  asset_type: string;
  side: string;
  qty: number | string;
  entry_price: number | null;
  current_price: number | null;
  tp_price: number | null;
  sl_price: number | null;
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
  handleSaveOrder: () => Promise<void>;
  setOnRefresh: (callback: () => void) => void;
}

export const useOrderEdit = (): UseOrderEditReturn => {
  const [editingOrder, setEditingOrder] = useState<SpreadOrder | null>(null);
  const [formData, setFormData] = useState<Partial<SpreadOrder>>({});
  const [showModal, setShowModal] = useState(false);
  // ใช้ useRef เพื่อให้ได้ latest reference ของ callback
  const onRefreshRef = useRef<() => void>(() => {});

  const startEdit = useCallback((order: SpreadOrder) => {
    setEditingOrder(order);
    setFormData({
      asset_type: order.asset_type,
      side: order.side,
      qty: order.qty,
      entry_price: order.entry_price,
      tp_price: order.tp_price,
      sl_price: order.sl_price,
      zone: order.zone,
    });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingOrder(null);
    setFormData({});
  }, []);

  const handleFormChange = useCallback((field: keyof Partial<SpreadOrder>, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveOrder = useCallback(async () => {
    if (!editingOrder) return;

    try {
      const response = await fetch(`/api/v1/orders/${editingOrder.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order: ${response.statusText}`);
      }

      // เรียก refresh function ก่อนปิด modal
      if (onRefreshRef.current) {
        onRefreshRef.current();
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving order:', error);
    }
  }, [editingOrder, formData]);

  return {
    editingOrder,
    formData,
    showModal,
    startEdit,
    closeModal,
    handleFormChange,
    handleSaveOrder,
    setOnRefresh: useCallback((callback: () => void) => {
      onRefreshRef.current = callback;
    }, []),
  };
};