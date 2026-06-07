import { useState, useCallback } from 'react';
import { SpreadOrder } from '../types';
import { api } from '../lib/api';

export const useZoneEditor = (onRefresh: () => void, portfolioId?: number) => {
  const [editingZoneOrders, setEditingZoneOrders] = useState<SpreadOrder[]>([]);
  const [editingZone, setEditingZone] = useState<string | null>(null);

  const handleEditZone = useCallback((orders: SpreadOrder[], zone: string) => {
    setEditingZoneOrders(orders);
    setEditingZone(zone);
  }, []);

  const handleCloseZoneModal = useCallback(() => {
    setEditingZoneOrders([]);
    setEditingZone(null);
  }, []);

  const handleSaveZone = useCallback(async (newZone: string) => {
    if (editingZoneOrders.length > 0) {
      try {
        for (const order of editingZoneOrders) {
          await api.updateOrder(order.order_id, { zone: newZone }, portfolioId);
        }
        onRefresh();
      } catch (error) {
        console.error('Error updating zone:', error);
      }
    }
    handleCloseZoneModal();
  }, [editingZoneOrders, onRefresh, portfolioId]);

  return {
    editingZoneOrders,
    editingZone,
    handleEditZone,
    handleCloseZoneModal,
    handleSaveZone,
  };
};