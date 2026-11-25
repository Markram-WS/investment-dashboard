import { useState, useCallback, useRef } from 'react';
import { SpreadOrder } from '../types';
import type { MappedOrderFields } from '../types';
import { api } from '../lib/api';
import type { OrderUpdatePayload } from '../lib/api';

/** Mapped-only `fee` rides beside the local SpreadOrder form fields. */
export interface OrderEditForm extends Partial<SpreadOrder> {
  fee?: number | string | null;
}

interface UseOrderEditReturn {
  editingOrder: SpreadOrder | null;
  formData: OrderEditForm;
  showModal: boolean;
  startEdit: (order: SpreadOrder) => void;
  closeModal: () => void;
  /** `unknown`: the form modals carry loosely typed input values. */
  handleFormChange: (field: keyof OrderEditForm, value: unknown) => void;
  handleSaveOrder: () => Promise<void>;
  setOnRefresh: (callback: () => void) => void;
}

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

const seedMappedFields = (order: SpreadOrder, fields: string[]): OrderEditForm => {
  const writable = new Set(fields);
  const form: OrderEditForm = {};
  if (writable.has('order_ref')) form.order_ref = order.order_ref ?? '';
  if (writable.has('asset_type')) form.asset_type = order.asset_type;
  if (writable.has('side')) form.side = mappedSide(order.side);
  if (writable.has('qty')) form.qty = order.qty;
  if (writable.has('entry_price')) form.entry_price = order.entry_price;
  if (writable.has('tp_price')) form.tp_price = order.tp_price;
  // The backend now exposes the foreign fee on mapped orders.
  if (writable.has('fee')) form.fee = order.fee ?? '';
  if (writable.has('remark')) form.remark = order.remark ?? '';
  return form;
};

export const useOrderEdit = (
  portfolioId?: number,
  mapped?: MappedOrderFields,
  /** Mapped portfolios require `order_source` on single-row writes. */
  mappedPortfolio = false,
): UseOrderEditReturn => {
  const [editingOrder, setEditingOrder] = useState<SpreadOrder | null>(null);
  const [formData, setFormData] = useState<OrderEditForm>({});
  const [showModal, setShowModal] = useState(false);
  const portfolioIdRef = useRef(portfolioId);
  portfolioIdRef.current = portfolioId;
  const mappedRef = useRef(mapped);
  mappedRef.current = mapped;
  const mappedPortfolioRef = useRef(mappedPortfolio);
  mappedPortfolioRef.current = mappedPortfolio;
  const onRefreshRef = useRef<() => void>(() => {});

  const startEdit = useCallback((order: SpreadOrder) => {
    setEditingOrder(order);
    const write = mappedRef.current;
    // Only a mapped-source row gets the foreign field list; a dashboard row on
    // the same portfolio uses the ordinary local option form.
    if (write && order.order_source === 'mapped') {
      setFormData(seedMappedFields(order, write.fields));
    } else {
      setFormData({
        asset_type: order.asset_type,
        side: order.side,
        qty: order.qty,
        entry_price: order.entry_price,
        tp_price: order.tp_price,
        sl_price: order.sl_price,
        group_id: order.group_id,
        order_status: order.order_status,
        contract_type: order.contract_type,
        direction: order.direction,
        expiry_date: order.expiry_date,
        strike_price: order.strike_price,
        cost: order.cost,
      });
    }
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingOrder(null);
    setFormData({});
  }, []);

  const handleFormChange = useCallback((field: keyof OrderEditForm, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveOrder = useCallback(async () => {
    if (!editingOrder) return;

    try {
      const write = mappedRef.current;
      const orderSource = mappedPortfolioRef.current ? editingOrder.order_source ?? undefined : undefined;
      if (write && editingOrder.order_source === 'mapped') {
        const writable = new Set(write.fields);
        const payload: OrderUpdatePayload = {};
        if (writable.has('order_ref')) payload.order_ref = formData.order_ref ?? '';
        if (writable.has('asset_type')) payload.asset_type = formData.asset_type;
        if (writable.has('side')) payload.side = mappedSide(formData.side);
        if (writable.has('qty')) payload.qty = mappedNumber(formData.qty);
        if (writable.has('entry_price')) payload.entry_price = mappedNumber(formData.entry_price);
        if (writable.has('tp_price')) payload.tp_price = mappedNumber(formData.tp_price);
        if (writable.has('fee')) {
          const fee = mappedNumber(formData.fee);
          if (fee !== null) payload.fee = fee;
        }
        if (writable.has('remark')) payload.remark = formData.remark ?? '';
        await api.updateOrder(editingOrder.order_id, payload, portfolioIdRef.current, orderSource);
      } else {
        await api.updateOrder(editingOrder.order_id, formData, portfolioIdRef.current, orderSource);
      }
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
