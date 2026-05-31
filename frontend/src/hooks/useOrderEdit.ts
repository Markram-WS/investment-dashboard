import { useState, useCallback, useRef } from 'react';
import { SpreadOrder } from '../types';
import { api } from '../lib/api';

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
      await api.updateOrder(editingOrder.order_id, formData);
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