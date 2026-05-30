import { useState, useCallback } from 'react';
import { SpreadOrder } from '../screens/types';

export const useZoneEditor = (onRefresh: () => void) => {
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
          await fetch(`/api/v1/orders/${order.order_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: newZone }),
          });
        }
        onRefresh();
      } catch (error) {
        console.error('Error updating zone:', error);
      }
    }
    handleCloseZoneModal();
  }, [editingZoneOrders, onRefresh]);

  return {
    editingZoneOrders,
    editingZone,
    handleEditZone,
    handleCloseZoneModal,
    handleSaveZone,
  };
};