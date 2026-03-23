import { useState, useCallback } from 'react';
import { API_BASE } from '../data';

export const useOrders = (showNotification, setLoading, customers) => {
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [orderToPrintFiscal, setOrderToPrintFiscal] = useState(null);
  
  const [orderSortBy, setOrderSortBy] = useState('time');
  const [orderFilterName, setOrderFilterName] = useState('');
  const [orderSortDirection, setOrderSortDirection] = useState('desc');
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [orderFilterPOS, setOrderFilterPOS] = useState(false);
  const [orderFilterDelivery, setOrderFilterDelivery] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/orders`);
      if (res.ok) setOrders(await res.json());
    } catch(err) { console.error('Err fetch orders', err); }
  }, []);

  const confirmPrintFiscal = async () => {
    if (!orderToPrintFiscal) return;
    
    if (orderToPrintFiscal.total_price < 0) {
      showNotification('Impossibile emettere scontrino fiscale con importo negativo', 'error');
      setOrderToPrintFiscal(null);
      return;
    }

    const order = orderToPrintFiscal;
    setOrderToPrintFiscal(null);
    setLoading(true);
    try {
      const customer = customers.find(c => c.id === order.customer_id);
      const res = await fetch(`${API_BASE}/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItems: JSON.parse(order.items_json),
          total: order.total_price,
          paymentType: order.payment_method,
          customer,
          orderType: order.order_type,
          deliveryTime: order.delivery_time
        }),
      });
      if (!res.ok) throw new Error('Errore server');
      showNotification('Scontrino Fiscale stampato!');
      try {
        await fetch(`${API_BASE}/orders/${order.id}/fiscalize`, { 
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: 2 })
        });
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, is_fiscalized: 2 } : o));
      } catch (e) {
        console.error('Errore nel salvataggio stato fiscale', e);
      }
    } catch (err) {
      console.error(err);
      alert('Impossibile stampare lo scontrino: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleRePrintOrder = async (order) => {
    setLoading(true);
    try {
      const customer = customers.find(c => c.id === order.customer_id);
      const res = await fetch(`${API_BASE}/print-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: order.order_type === 'DOMICILIO' ? 'DOMICILIO' : 'ASPORTO',
          orderItems: JSON.parse(order.items_json),
          customer,
          orderType: order.order_type,
          deliveryTime: order.delivery_time
        }),
      });
      if (!res.ok) throw new Error('Errore server');
      showNotification('Copia ordine stampata!');
    } catch (err) {
      alert('Errore stampa copia: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmPrintNonFiscal = async () => {
    if (!orderToPrintFiscal) return;
    const order = orderToPrintFiscal;
    setOrderToPrintFiscal(null);
    await handleRePrintOrder(order); // Epson Ticket as Proforma
    try {
      await fetch(`${API_BASE}/orders/${order.id}/fiscalize`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 1 })
      });
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, is_fiscalized: Math.max(o.is_fiscalized || 0, 1) } : o));
    } catch (e) {
      console.error('Errore nel salvataggio stato NON fiscale', e);
    }
  };

  const handlePrintFiscal = (order) => {
    setOrderToPrintFiscal(order);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const id = orderToDelete;
    setOrderToDelete(null);
    try {
      const res = await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        showNotification('Errore eliminazione', 'error');
        return;
      }
      showNotification('Ordine eliminato');
      if (editingOrderId === id) {
        setEditingOrderId(null);
      }
      fetchOrders();
    } catch (err) {
      showNotification('Errore', 'error');
    }
  };

  const handleDeleteOrder = (id) => {
    setOrderToDelete(id);
  };

  const proceedWithCloseDay = async () => {
    setShowCloseDayModal(false);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/close-day`, { method: 'POST' });
      if (!res.ok) throw new Error('Server Errore');
      showNotification('Chiusura Fiscale Completata');
    } catch (err) {
      showNotification('Errore K3', 'error');
    } finally {
      setLoading(false);
    }
  };

  return {
    orders, setOrders,
    editingOrderId, setEditingOrderId,
    expandedOrderId, setExpandedOrderId,
    orderToDelete, setOrderToDelete,
    orderToPrintFiscal, setOrderToPrintFiscal,
    orderSortBy, setOrderSortBy,
    orderFilterName, setOrderFilterName,
    orderSortDirection, setOrderSortDirection,
    showCloseDayModal, setShowCloseDayModal,
    orderFilterPOS, setOrderFilterPOS,
    orderFilterDelivery, setOrderFilterDelivery,
    
    fetchOrders,
    confirmPrintFiscal,
    confirmPrintNonFiscal,
    handlePrintFiscal,
    handleRePrintOrder,
    confirmDeleteOrder,
    handleDeleteOrder,
    proceedWithCloseDay
  };
};
