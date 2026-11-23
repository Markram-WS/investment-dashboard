import { useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import type { OrderPayload } from '../lib/api';
import type { MappedOrderFields } from '../types';

export interface AddOrderForm {
  order_id: string;
  asset_type: string;
  side: string;
  qty: number | string;
  entry_price: number | string;
  tp_price: number | string;
  sl_price: number | string;
  group_id: number | null;
  order_status: string;
  contract_type: 'spot' | 'future' | 'option';
  direction: string;
  option_type: string;
  expiry_date: string;
  strike_price: number | string;
  cost: number | string;
  /** Mapped-only fields; ignored by the local write path. */
  order_ref?: string;
  fee?: number | string;
  remark?: string;
}

export interface CreateOrderResult {
  ok: boolean;
  message?: string;
}

interface UseAddOrderReturn {
  showModal: boolean;
  formData: AddOrderForm;
  openModal: (preset?: Partial<AddOrderForm>) => void;
  closeModal: () => void;
  /** `unknown`: the form modals carry loosely typed input values. */
  handleFormChange: (field: keyof AddOrderForm, value: unknown) => void;
  handleCreateOrder: (portfolioId: number, mapped?: MappedOrderFields) => Promise<CreateOrderResult>;
  setOnCreated: (callback: () => void) => void;
}

const genId = () => Math.random().toString(36).slice(2, 10).toUpperCase();

/** Mapped side values are LONG/SHORT; the local form speaks BUY/SELL. */
const mappedSide = (side: unknown): string => {
  const value = String(side ?? '').trim().toUpperCase();
  if (value === 'BUY') return 'LONG';
  if (value === 'SELL') return 'SHORT';
  return value || 'LONG';
};

const mappedNumber = (value: unknown): number | null => {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
};

const createErrorMessage = (error: unknown): string => {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === 'number') return `Create order failed (HTTP ${status})`;
  return 'Create order failed';
};

const defaultForm: AddOrderForm = {
  order_id: genId(),
  asset_type: '',
  side: 'BUY',
  qty: '',
  entry_price: '',
  tp_price: '',
  sl_price: '',
  group_id: null,
  order_status: 'FILLED',
  contract_type: 'spot',
  direction: '',
  option_type: '',
  expiry_date: '',
  strike_price: '',
  cost: '',
};

export const useAddOrder = (): UseAddOrderReturn => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<AddOrderForm>({ ...defaultForm });
  const onCreatedRef = useRef<() => void>(() => {});

  const openModal = useCallback((preset?: Partial<AddOrderForm>) => {
    setFormData({ ...defaultForm, order_id: genId(), ...preset });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setFormData({ ...defaultForm });
  }, []);

  const handleFormChange = useCallback((field: keyof AddOrderForm, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateOrder = useCallback(async (
    portfolioId: number,
    mapped?: MappedOrderFields,
  ): Promise<CreateOrderResult> => {
    const orderId = String(formData.order_id ?? '').trim() || genId();
    try {
      if (mapped) {
        const fields = new Set(mapped.fields);
        const payload: OrderPayload = { portfolio_id: portfolioId };
        if (!mapped.keyGenerated) payload.order_id = orderId;
        if (fields.has('asset_type')) payload.asset_type = formData.asset_type;
        if (fields.has('side')) payload.side = mappedSide(formData.side);
        if (fields.has('qty')) payload.qty = mappedNumber(formData.qty);
        if (fields.has('entry_price')) payload.entry_price = mappedNumber(formData.entry_price);
        if (fields.has('tp_price')) payload.tp_price = mappedNumber(formData.tp_price);
        if (fields.has('fee')) payload.fee = mappedNumber(formData.fee);
        if (fields.has('remark')) {
          const remark = String(formData.remark ?? '').trim();
          if (remark) payload.remark = remark;
        }
        if (fields.has('order_ref')) {
          const orderRef = String(formData.order_ref ?? '').trim();
          if (orderRef) payload.order_ref = orderRef;
        }
        await api.createOrder(payload);
      } else {
        await api.createOrder({
          order_id: orderId,
          portfolio_id: portfolioId,
          asset_type: formData.asset_type,
          side: formData.side,
          qty: formData.qty !== '' ? parseFloat(formData.qty as string) : null,
          entry_price: formData.entry_price !== '' ? parseFloat(formData.entry_price as string) : null,
          tp_price: formData.tp_price !== '' ? parseFloat(formData.tp_price as string) : null,
          sl_price: formData.sl_price !== '' ? parseFloat(formData.sl_price as string) : null,
          group_id: formData.group_id,
          order_status: formData.order_status,
          contract_type: formData.contract_type,
          direction: formData.direction || undefined,
          option_type: formData.option_type || undefined,
          expiry_date: formData.expiry_date ? new Date(formData.expiry_date).toISOString() : undefined,
          strike_price: formData.strike_price !== '' ? parseFloat(formData.strike_price as string) : undefined,
          cost: formData.cost !== '' ? parseFloat(formData.cost as string) : 0,
        });
      }
      if (onCreatedRef.current) {
        await onCreatedRef.current();
      }
      setShowModal(false);
      return { ok: true };
    } catch (error) {
      console.error('Error creating order:', error);
      return { ok: false, message: createErrorMessage(error) };
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