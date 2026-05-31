import { useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';

interface AddOrderForm {
  order_id: string;
  asset_type: string;
  side: string;
  qty: number | string;
  entry_price: number | string;
  tp_price: number | string;
  sl_price: number | string;
  zone: string;
  order_status: string;
}

interface UseAddOrderReturn {
  showModal: boolean;
  formData: AddOrderForm;
  openModal: () => void;
  closeModal: () => void;
  handleFormChange: (field: keyof AddOrderForm, value: any) => void;
  handleCreateOrder: (portfolioId: number) => Promise<void>;
  setOnCreated: (callback: () => void) => void;
}

const genId = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const defaultForm: AddOrderForm = {
  order_id: genId(),
  asset_type: '',
  side: 'BUY',
  qty: '',
  entry_price: '',
  tp_price: '',
  sl_price: '',
  zone: '',
  order_status: 'PENDING',
};

export const useAddOrder = (): UseAddOrderReturn => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<AddOrderForm>({ ...defaultForm });
  const onCreatedRef = useRef<() => void>(() => {});

  const openModal = useCallback(() => {
    setFormData({ ...defaultForm, order_id: genId() });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setFormData({ ...defaultForm });
  }, []);

  const handleFormChange = useCallback((field: keyof AddOrderForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateOrder = useCallback(async (portfolioId: number) => {
    try {
      await api.createOrder({
        order_id: formData.order_id || undefined,
        portfolio_id: portfolioId,
        asset_type: formData.asset_type,
        side: formData.side,
        qty: formData.qty !== '' ? parseFloat(formData.qty as string) : null,
        entry_price: formData.entry_price !== '' ? parseFloat(formData.entry_price as string) : null,
        tp_price: formData.tp_price !== '' ? parseFloat(formData.tp_price as string) : null,
        sl_price: formData.sl_price !== '' ? parseFloat(formData.sl_price as string) : null,
        zone: formData.zone || null,
        order_status: formData.order_status,
      });
      if (onCreatedRef.current) {
        await onCreatedRef.current();
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error creating order:', error);
    }
  }, [formData]);

  return {
    showModal,
    formData,
    openModal,
    closeModal,
    handleFormChange,
    handleCreateOrder,
    setOnCreated: useCallback((callback: () => void) => {
      onCreatedRef.current = callback;
    }, []),
  };
};
