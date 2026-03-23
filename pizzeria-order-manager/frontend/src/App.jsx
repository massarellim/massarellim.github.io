import React, { useState, useEffect, useRef } from 'react';
import './App.css';

import { useCart } from './hooks/useCart';
import { useCustomers } from './hooks/useCustomers';
import { useOrders } from './hooks/useOrders';

import {
  IconEdit, IconTrash, IconReceipt,
  IconPlus, IconMinus, IconDollar, IconMoto
} from './Icons';

import {
  MENU_ITEMS, CATEGORIES_MENU, CATEGORIES_BACKOFFICE,
  INGREDIENT_MODIFIERS, SPECIAL_MODIFIERS,
  getRemovalDiscount, API_BASE, getNearest10MinSlot
} from './data';

function App() {
  const [activeTab, setActiveTab] = useState('pizze');
  const [mainView, setMainView] = useState('MENU');
  const [paymentType, setPaymentType] = useState('CASH');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState('ASPORTO');
  const [isDeliveryFeeWaived, setIsDeliveryFeeWaived] = useState(false);
  const [deliveryFeeQuantity, setDeliveryFeeQuantity] = useState(1);
  const [orderConfigModalOpen, setOrderConfigModalOpen] = useState(false);
  const [isOrderConfigured, setIsOrderConfigured] = useState(false);
  const [isLunchSlot, setIsLunchSlot] = useState(() => new Date().getHours() < 15);
  const [deliveryTime, setDeliveryTime] = useState(getNearest10MinSlot());
  const [hoveredTime, setHoveredTime] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const {
    customers, setCustomers,
    selectedCustomer, setSelectedCustomer,
    customerModalOpen, setCustomerModalOpen,
    customerForm, setCustomerForm,
    customerToDelete, setCustomerToDelete,
    customerSortBy, setCustomerSortBy,
    customerSortDirection, setCustomerSortDirection,
    customerSearchQuery, setCustomerSearchQuery,
    showCustomerDropdown, setShowCustomerDropdown,
    isCustomerSearchFocused, setIsCustomerSearchFocused,
    customerFilter, setCustomerFilter,
    fetchCustomers,
    handleSaveCustomer,
    deleteCustomer
  } = useCustomers(showNotification, setIsOrderConfigured, setLoading);

  const {
    cart, setCart,
    cartTotal,
    editingItem, setEditingItem,
    customModalOpen, setCustomModalOpen,
    customModalContext, setCustomModalContext,
    customModalForm, setCustomModalForm,
    familyHalfIndex, setFamilyHalfIndex,
    selectingHalfFor, setSelectingHalfFor,
    cartEndRef,
    calculateItemPrice,
    addToCart,
    formatModifiers,
    handleAddFamilyPizza,
    updateQuantity,
    removeItem,
    openEditor,
    toggleModifier,
    handleAddCustom
  } = useCart(orderType, deliveryFeeQuantity);

  const {
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
  } = useOrders(showNotification, setLoading, customers);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const displayedItems = MENU_ITEMS.filter(item => activeTab === 'tutte' ? true : item.category === activeTab);

  // --- Funzioni API ---
  const handleEditOrder = (order) => {
    const rawItems = JSON.parse(order.items_json);
    const parsedCart = rawItems.filter(i => i.id !== 'delivery_fee');
    const deliveryFeeItem = rawItems.find(i => i.id === 'delivery_fee');
    setCart(parsedCart);
    setOrderType(order.order_type === 'DOMICILIO' ? 'DOMICILIO' : 'ASPORTO');
    setDeliveryFeeQuantity(order.order_type === 'DOMICILIO' ? (deliveryFeeItem ? deliveryFeeItem.quantity : 0) : 1);
    setDeliveryTime(order.delivery_time || getNearest10MinSlot());
    setPaymentType(order.payment_method || 'CASH');
    setIsOrderConfigured(true);
    setEditingOrderId(order.id);
    if (order.customer_id) {
      const cust = customers.find(c => c.id === order.customer_id);
      setSelectedCustomer(cust || null);
    } else {
      setSelectedCustomer(null);
    }
    setMainView('MENU');
    setActiveTab('pizze');
    setCustomerSearchQuery('');
    showNotification(`Ordine #${order.id} caricato in cassa.`);
  };



  const handlePrintTicket = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    
    const payloadItems = cart.map(item => ({ ...item }));

    if (orderType === 'DOMICILIO' && deliveryFeeQuantity > 0) {
      payloadItems.push({
        id: 'delivery_fee',
        name: 'Spese di Consegna',
        price: 2.00,
        quantity: deliveryFeeQuantity,
        category: 'altro'
      });
    }

    payloadItems.sort((a, b) => {
      const aNote = a.category === 'altro' && a.price === 0;
      const bNote = b.category === 'altro' && b.price === 0;
      if (aNote && !bNote) return 1;
      if (!aNote && bNote) return -1;
      return 0;
    });

    try {
      const res = await fetch(`${API_BASE}/print-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: Date.now().toString().slice(-6),
          table: orderType === 'DOMICILIO' ? 'DOMICILIO' : 'ASPORTO',
          orderItems: payloadItems,
          customer: selectedCustomer,
          orderType,
          deliveryTime
        }),
      });
      if (!res.ok) throw new Error('Errore server');
      showNotification('Comanda inviata in cucina!');
    } catch (err) {
      showNotification('Errore di connessione Epson', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const payloadItems = cart.map(item => ({ ...item }));

    if (orderType === 'DOMICILIO' && deliveryFeeQuantity > 0) {
      payloadItems.push({
        id: 'delivery_fee',
        name: 'Spese di Consegna',
        price: 2.00,
        quantity: deliveryFeeQuantity,
        category: 'altro'
      });
    }

    payloadItems.sort((a, b) => {
      const aNote = a.category === 'altro' && a.price === 0;
      const bNote = b.category === 'altro' && b.price === 0;
      if (aNote && !bNote) return 1;
      if (!aNote && bNote) return -1;
      return 0;
    });

    try {
      const res = await fetch(`${API_BASE}/save-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editingOrderId,
          total: cartTotal,
          paymentType,
          orderItems: payloadItems,
          customer: selectedCustomer,
          orderType,
          deliveryTime
        }),
      });
      if (!res.ok) throw new Error('Errore server');
      showNotification(editingOrderId ? 'Ordine aggiornato!' : 'Ordine inserito a sistema!');
      await fetchOrders();
      setCart([]);
      setEditingItem(null);
      setEditingOrderId(null);
      setSelectedCustomer(null);
      setCustomerSearchQuery('');
      setOrderType('ASPORTO');
      setDeliveryFeeQuantity(1);
      setDeliveryTime(getNearest10MinSlot());
      setPaymentType('CASH');
      setIsOrderConfigured(false);
    } catch (err) {
      showNotification('Errore salvataggio', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  const renderOrderCard = (o) => {
    const itemsList = JSON.parse(o.items_json);
    const c = customers.find(cust => cust.id === o.customer_id);
    const isExpanded = expandedOrderId === o.id;
    const totalItemsQty = itemsList.reduce((sum, item) => {
      const isPizza = item.category ? item.category === 'pizze' : true;
      return sum + (isPizza ? (item.quantity || 1) : 0);
    }, 0);

    const totalsByCategory = itemsList.reduce((acc, item) => {
      const c = item.category || 'pizze';
      acc[c] = (acc[c] || 0) + (item.quantity || 1);
      return acc;
    }, {});
    
    return (
      <div key={o.id} className="customer-card" style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: 0, borderRadius: '8px', overflow: 'hidden'}}>
        
        {/* Riga Compatta */}
        <div 
          onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
          style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px', padding: '10px 15px', cursor: 'pointer', boxSizing: 'border-box'}}
        >
          
          {/* Contenitore per Info Ordine ed Elementi prezzo */}
          <div style={{display: 'flex', alignItems: 'center', gap: '15px', flex: 1, minWidth: '250px', flexWrap: 'wrap'}}>
            
            <div style={{fontWeight: '900', fontSize: '1.1rem', color: 'var(--text-dark)', minWidth: '40px'}}>
              #{o.id}
            </div>
            
            {orderSortBy === 'id' && (
              <div style={{fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-dark)', minWidth: '55px'}}>
                {o.delivery_time}
              </div>
            )}
            
            {/* Nome e Via con flex-grow e left-align */}
            <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', color: 'var(--text-dark)', flex: 1, minWidth: '150px'}}>
               <div style={{display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: '1.05rem'}}>
                 {c ? c.name : (o.order_type === 'DOMICILIO' ? 'Consegna' : 'Asporto')} 
               </div>
               {c && c.address && (
                 <div style={{fontSize: '0.9rem', color: 'var(--text-light)', marginTop: '2px'}}>
                   {c.address}
                 </div>
               )}
            </div>

            {/* Blocco Destro: Pezzi, POS, Prezzo rigorosamente incolonnati */}
            <div style={{display: 'flex', alignItems: 'center', gap: '15px', minWidth: '180px', justifyContent: 'flex-end'}}>
              <div style={{color: 'var(--text-light)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '85px'}}>
                <span style={{fontWeight: 'bold', color: 'var(--text-dark)', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '14px'}}>
                  {o.order_type === 'DOMICILIO' && <span title="Consegna a domicilio" style={{display: 'flex', alignItems: 'center', color: 'var(--text-light)'}}><IconMoto /></span>}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '2px solid var(--text-dark)',
                    color: 'var(--text-dark)',
                    fontSize: '1rem',
                    fontWeight: 'bold'
                  }} title={`${totalItemsQty} articoli in totale`}>
                     {totalItemsQty}
                  </div>
                </span>
              </div>

              {o.payment_method === 'CARD' ? (
                 <div style={{color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: '900', minWidth: '35px', textAlign: 'center'}}>
                   POS
                 </div>
              ) : (
                 <div style={{minWidth: '35px'}}></div> /* Spacer per mantenere allineamento perfetto */
              )}
              
              <div style={{fontWeight: '900', fontSize: '1.15rem', color: 'var(--text-dark)', minWidth: '85px', textAlign: 'right'}}>
                € {(o.total_price || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Bottoni Azione a Icona */}
          <div style={{display: 'flex', gap: '8px', marginLeft: '35px', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0}}>
            <button style={{padding: '6px', backgroundColor: '#f1f2f6', border: '1px solid #ced6e0', borderRadius: '8px', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#576574'}} title="Modifica" onClick={(e) => { e.stopPropagation(); handleEditOrder(o); }}>
              <IconEdit />
            </button>
            <button style={{padding: '6px', backgroundColor: '#f1f2f6', border: '1px solid #ced6e0', borderRadius: '8px', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)'}} title="Elimina" onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.id); }}>
              <IconTrash />
            </button>
            <button style={{padding: '6px', backgroundColor: '#f1f2f6', border: '1px solid #ced6e0', borderRadius: '8px', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#576574'}} title="Stampa Copia Ordine" onClick={(e) => { e.stopPropagation(); handleRePrintOrder(o); }}>
              <IconReceipt />
            </button>
            <button 
              style={{
                padding: '6px', 
                backgroundColor: o.is_fiscalized === 2 ? 'rgba(39, 174, 96, 0.1)' : '#f1f2f6', 
                border: `1px solid ${o.is_fiscalized === 2 ? '#27ae60' : '#ced6e0'}`, 
                borderRadius: '8px', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: o.is_fiscalized ? '#27ae60' : '#576574',
                transition: 'all 0.3s'
              }} 
              title="Scontrino Fiscale" 
              onClick={(e) => { e.stopPropagation(); handlePrintFiscal(o); }}
            >
              <IconDollar />
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); setExpandedOrderId(isExpanded ? null : o.id); }} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px', marginLeft: '10px', color: 'var(--text-light)'}}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 {isExpanded ? <polyline points="18 15 12 9 6 15"></polyline> : <polyline points="6 9 12 15 18 9"></polyline>}
               </svg>
            </button>
          </div>

        </div>

        {/* Dettagli Espansi */}
        {isExpanded && (
          <div style={{
            padding: '20px', 
            borderTop: '1px solid var(--border-color)', 
            backgroundColor: '#f8f9fa'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', marginBottom: '12px', gap: '15px'}}>
              
              {/* SX: Riepilogo Categorie */}
              <div style={{flex: 1, backgroundColor: 'white', padding: '10px 18px', borderRadius: '6px', border: '1px solid #eaeaea', display: 'flex', alignItems: 'center'}}>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: 'var(--text-dark)', fontSize: '0.95rem', width: '100%'}}>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <strong style={{minWidth: '24px', textAlign: 'left', color: totalsByCategory['pizze'] ? 'inherit' : 'var(--text-light)'}}>{totalsByCategory['pizze'] || '-'}</strong>
                      <span>Pizze</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <strong style={{minWidth: '24px', textAlign: 'left', color: totalsByCategory['bevande'] ? 'inherit' : 'var(--text-light)'}}>{totalsByCategory['bevande'] || '-'}</strong>
                      <span>Bevande</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <strong style={{minWidth: '24px', textAlign: 'left', color: totalsByCategory['fritture'] ? 'inherit' : 'var(--text-light)'}}>{totalsByCategory['fritture'] || '-'}</strong>
                      <span>Fritture</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <strong style={{minWidth: '24px', textAlign: 'left', color: totalsByCategory['dolci'] ? 'inherit' : 'var(--text-light)'}}>{totalsByCategory['dolci'] || '-'}</strong>
                      <span>Dolci</span>
                    </div>
                  </div>
              </div>

              {/* CX: Cliente e Telefono */}
              <div style={{flex: 1, backgroundColor: 'white', padding: '10px 18px', borderRadius: '6px', border: '1px solid #eaeaea', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                {(!c?.name && !c?.phone) ? (
                  <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.9rem'}}>Nessun nominativo salvato</div>
                ) : (
                  <>
                    {c?.name ? (
                      <div style={{color: 'var(--text-dark)', fontWeight: 'bold', fontSize: '1rem', marginBottom: c?.phone ? '2px' : '0'}}>{c.name}</div>
                    ) : (
                      <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '2px'}}>Nessun Nominativo salvato</div>
                    )}
                    {c?.phone ? (
                      <div style={{color:'var(--text-dark)', fontSize: '1.05rem', letterSpacing: '0.5px'}}>
                        {c.phone}
                      </div>
                    ) : (
                      <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '2px'}}>Nessun numero salvato</div>
                    )}
                  </>
                )}
              </div>

              {/* DX: Indirizzo e note */}
              <div style={{flex: 1, backgroundColor: 'white', padding: '10px 18px', borderRadius: '6px', border: '1px solid #eaeaea', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                {c?.address ? (
                  <div style={{color:'var(--text-dark)'}}>{c.address}</div>
                ) : (
                  <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.9rem'}}>Nessun indirizzo salvato</div>
                )}
                {c?.notes && <div style={{color:'var(--text-dark)', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '4px'}}>{c.notes}</div>}
              </div>

            </div>
            
            <ul style={{listStyle: 'none', margin: 0, color: 'var(--text-dark)', backgroundColor: 'white', border: '1px solid #eaeaea', borderRadius: '6px', padding: '10px 18px'}}>
              {[...itemsList].sort((a, b) => {
                const aNote = a.category === 'altro' && a.price === 0;
                const bNote = b.category === 'altro' && b.price === 0;
                if (aNote && !bNote) return 1;
                if (!aNote && bNote) return -1;
                return 0;
              }).map((item, idx) => (
                <li key={idx} style={{marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: idx < itemsList.length -1 ? '1px solid #eaeaea' : 'none', paddingBottom: idx < itemsList.length -1 ? '6px' : '0'}}>
                  <div style={{display: 'flex', alignItems: 'flex-start', textAlign: 'left', paddingRight: '15px'}}>
                    <strong style={{minWidth: '28px', flexShrink: 0, paddingTop: '1px'}}>{item.quantity}x</strong>
                    <div style={{display: 'flex', flexDirection: 'column'}}>
                      <div style={{lineHeight: '1.4', fontWeight: 'bold'}}>{item.name}</div>
                      {(() => {
                        if (item.isFamily) {
                           let fparts = [];
                           if (item.halves && item.halves[0]) {
                              const m1 = formatModifiers(item.halves[0].modifiers);
                              fparts.push(`½ ${item.halves[0].name}${m1 ? ' (' + m1 + ')' : ''}`);
                           }
                           if (item.halves && item.halves[1]) {
                              const m2 = formatModifiers(item.halves[1].modifiers);
                              fparts.push(`½ ${item.halves[1].name}${m2 ? ' (' + m2 + ')' : ''}`);
                           }
                           if (item.manualPriceDelta > 0) fparts.push(`Sovrapprezzo (+${item.manualPriceDelta.toFixed(2)}€)`);
                           else if (item.manualPriceDelta < 0) fparts.push(`Sconto (${item.manualPriceDelta.toFixed(2)}€)`);
                           
                           if (fparts.length > 0) {
                              return (
                                <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.4'}}>
                                  {fparts.map((part, i) => <div key={i}>{part}</div>)}
                                </div>
                              );
                           }
                        } else {
                           const mStr = formatModifiers(item.modifiers, item.manualPriceDelta);
                           if (mStr) {
                             return (
                               <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.4'}}>
                                 {mStr}
                               </div>
                             );
                           }
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <span style={{fontWeight: 'bold', flexShrink: 0, paddingTop: '1px'}}>
                    {item.category === 'altro' && item.price === 0 ? '' : `€ ${(item.price * item.quantity).toFixed(2)}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="pos-container"
      onWheelCapture={(e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          if (e.deltaX > 50 && mainView === 'MENU') {
            setMainView('BACKOFFICE');
            setActiveTab('ordini');
          } else if (e.deltaX < -50 && mainView === 'BACKOFFICE') {
            setMainView('MENU');
            setActiveTab('pizze');
          }
        }
      }}
      onTouchStartCapture={(e) => {
        window.touchStartX = e.changedTouches[0].screenX;
        window.touchStartY = e.changedTouches[0].screenY;
      }}
      onTouchEndCapture={(e) => {
        const endX = e.changedTouches[0].screenX;
        const endY = e.changedTouches[0].screenY;
        const startX = window.touchStartX || 0;
        const startY = window.touchStartY || 0;
        const diffX = startX - endX;
        const diffY = startY - endY;
        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 80 && mainView === 'MENU') {
            setMainView('BACKOFFICE');
            setActiveTab('ordini');
          } else if (diffX < -80 && mainView === 'BACKOFFICE') {
            setMainView('MENU');
            setActiveTab('pizze');
          }
        }
      }}
    >
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* MODALE MODIFICA INGREDIENTI */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50px', position: 'relative'}}>
              <h2 style={{margin: 0, textAlign: 'center', fontSize: '1.4rem'}}>
                {editingItem.isFamily && familyHalfIndex !== null && editingItem.halves[familyHalfIndex]
                  ? `½ ${editingItem.halves[familyHalfIndex].name}`
                  : editingItem.name}
              </h2>
            </div>
            <div className="modal-body-scroll">
              {(() => {
                const currentEditTarget = (editingItem.isFamily && familyHalfIndex !== null) ? editingItem.halves[familyHalfIndex] : editingItem;
                if (!currentEditTarget) return null;
                
                return (
                  <>
                  {currentEditTarget.ingredients && currentEditTarget.ingredients.length > 0 && (
                    <>
                      <div className="modifiers-grid" style={{marginBottom: '10px'}}>
                        {currentEditTarget.ingredients.map((ingr, i) => {
                          const discount = getRemovalDiscount(ingr);
                          const modValue = `- ${ingr}`;
                          const isRemoved = currentEditTarget.modifiers?.find(m => m.value === modValue);
                          
                          return (
                            <button 
                              key={`base-${i}`} 
                              className="modifier-btn"
                              onClick={() => toggleModifier({ label: `Senza ${ingr}`, value: modValue, price: -discount })}
                              style={!isRemoved ? {
                                borderColor: '#27ae60',
                                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                                color: '#27ae60',
                              } : {
                                color: '#a4b0be',
                              }}
                            >
                              {isRemoved ? `✗ ${ingr}${discount > 0 ? ` (-${discount.toFixed(2)}€)` : ''}` : `${ingr}${discount > 0 ? ` (-${discount.toFixed(2)}€)` : ''}`}
                            </button>
                          )
                        })}
                      </div>
                      <hr className="modal-divider" />
                    </>
                  )}

                  {/* OPZIONI SPECIALI (Baby, Big, Integrale, Lattosio) */}
                  <div className="modifiers-grid" style={{marginBottom: '10px'}}>
                    {SPECIAL_MODIFIERS.map((mod, i) => {
                      const isActive = currentEditTarget.modifiers?.find(m => m.value === mod.value);
                      return (
                        <button 
                          key={`special-${i}`} 
                          className={`modifier-btn ${isActive ? 'active' : ''}`}
                          onClick={() => toggleModifier(mod)}
                          style={{ 
                            borderColor: isActive ? '#3498db' : 'var(--border-color)', 
                            color: isActive ? '#3498db' : 'var(--text-dark)', 
                            backgroundColor: isActive ? 'rgba(52, 152, 219, 0.1)' : 'white' 
                          }}
                        >
                          {mod.label}
                        </button>
                      )
                    })}
                    {/* Modificatori Personalizzati (Aggiunte Libere) */}
                    {(() => {
                      const preVals = [...INGREDIENT_MODIFIERS.map(m => m.value), ...SPECIAL_MODIFIERS.map(m => m.value)];
                      const customMods = currentEditTarget.modifiers ? currentEditTarget.modifiers.filter(m => !preVals.includes(m.value) && !m.value.startsWith('- ')) : [];
                      
                      return customMods.map((mod, i) => (
                        <button 
                          key={`custom-${i}`}
                          className="modifier-btn active"
                          onClick={() => toggleModifier(mod)}
                          style={{ 
                            borderColor: '#3498db', 
                            color: '#3498db', 
                            backgroundColor: 'rgba(52, 152, 219, 0.1)' 
                          }}
                        >
                          {mod.label} {mod.price !== 0 ? `(${(mod.price > 0 ? '+' : '')}${mod.price.toFixed(2)}€)` : ''}
                        </button>
                      ));
                    })()}

                    {/* Bottone + Aggiunta Libera */}
                    <button 
                      className="modifier-btn"
                      onClick={() => {
                        setCustomModalContext('ITEM');
                        setCustomModalForm({ name: '', price: 0 });
                        setCustomModalOpen(true);
                      }}
                      style={{ 
                        borderColor: '#dfe4ea', 
                        borderStyle: 'dashed',
                        borderWidth: '2px',
                        color: 'var(--text-dark)', 
                        backgroundColor: 'white',
                        fontWeight: 'bold'
                      }}
                    >
                      + Aggiunta Libera
                    </button>
                  </div>
                  <hr className="modal-divider" />

                  <div className="modifiers-grid">
                    {INGREDIENT_MODIFIERS.map((mod, i) => {
                      const isActive = currentEditTarget.modifiers?.find(m => m.value === mod.value);
                      return (
                        <button 
                          key={`add-${i}`} 
                          className={`modifier-btn ${isActive ? 'active' : ''}`}
                          onClick={() => toggleModifier(mod)}
                        >
                          {mod.label}
                        </button>
                      )
                    })}
                  </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE ORDINE */}
      {orderToDelete && (
        <div className="modal-overlay" onClick={() => setOrderToDelete(null)} style={{zIndex: 4000}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{textAlign: 'center', padding: '30px', maxWidth: '400px'}}>
            <h2>Eliminare l'ordine #{orderToDelete}?</h2>
            <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>L'azione è irreversibile e i dati andranno persi.</p>
            <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
              <button className="btn-primary" onClick={confirmDeleteOrder}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE CLIENTE */}
      {customerToDelete && (
        <div className="modal-overlay" onClick={() => setCustomerToDelete(null)} style={{zIndex: 4000}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{textAlign: 'center', padding: '30px', maxWidth: '400px'}}>
            <h2>Eliminare {customerToDelete.name}?</h2>
            <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>L'azione è irreversibile e cancellerà la scheda dalla rubrica.</p>
            <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
              <button className="btn-primary" onClick={deleteCustomer}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA SCONTRINO FISCALE */}
      {orderToPrintFiscal && (
        <div className="modal-overlay" onClick={() => setOrderToPrintFiscal(null)} style={{zIndex: 4000}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{textAlign: 'center', padding: '30px', maxWidth: '400px'}}>
            {orderToPrintFiscal.is_fiscalized === 2 ? (
              <>
                 <div style={{color: 'var(--primary-color)', marginBottom: '15px', display: 'flex', justifyContent: 'center'}}>
                   <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                     <line x1="12" y1="9" x2="12" y2="13"></line>
                     <line x1="12" y1="17" x2="12.01" y2="17"></line>
                   </svg>
                 </div>
                 <h2>Scontrino Fiscale già emesso!</h2>
                 <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>L'ordine #{orderToPrintFiscal.id} verrà inviato nuovamente al registratore telematico.</p>
                 <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
                   <button className="btn-primary" onClick={confirmPrintFiscal}>Ristampa</button>
                 </div>
              </>
            ) : (
              <>
                <h2>Emettere Scontrino?</h2>
                <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>L'ordine #{orderToPrintFiscal.id} verrà inviato al registratore telematico.</p>
                <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
                  <button 
                    onClick={confirmPrintNonFiscal} 
                    style={{flex: 1, padding: '12px', border: '2px solid var(--text-dark)', backgroundColor: 'white', color: 'var(--text-dark)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem'}}
                  >Non Fiscale</button>
                  <button className="btn-success" style={{flex: 1}} onClick={confirmPrintFiscal}>Fiscale</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODALE CONFERMA CHIUSURA FISCALE */}
      {showCloseDayModal && (
        <div className="modal-overlay" onClick={() => setShowCloseDayModal(false)} style={{zIndex: 4000}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{textAlign: 'center', padding: '30px', maxWidth: '400px'}}>
             <div style={{color: 'var(--primary-color)', marginBottom: '15px', display: 'flex', justifyContent: 'center'}}>
               <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
             </div>
             <h2>Chiusura Fiscale</h2>
             <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>La chiusura giornaliera verrà inviata al registratore telematico.</p>
             <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
               <button className="btn-primary" onClick={proceedWithCloseDay}>Stampa Chiusura</button>
             </div>
          </div>
        </div>
      )}

      {/* MODALE UNIFICATA AGGIUNTA LIBERA */}
      {customModalOpen && (
        <div className="modal-overlay" onClick={() => setCustomModalOpen(false)} style={{zIndex: 3000}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
             <div className="modal-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '50px', marginBottom: '15px'}}>
               <h2 style={{margin: 0, fontSize: '1.4rem', textAlign: 'left'}}>Aggiunta Libera</h2>
               <div className="cart-item-controls" style={{ display: 'flex', alignItems: 'center', transform: 'scale(1.1)', transformOrigin: 'right center', margin: 0, border: '1px solid #dfe4ea' }}>
                  <button className="qty-btn" type="button" onClick={() => setCustomModalForm({...customModalForm, price: customModalForm.price - 0.5})}><IconMinus /></button>
                  <span className="qty-text" style={{margin: '0', fontWeight: 'bold', width: '64px', textAlign: 'center', display: 'inline-block'}}>{(customModalForm.price || 0) > 0 ? '+' : ''}{(customModalForm.price || 0).toFixed(2)}€</span>
                  <button className="qty-btn" type="button" onClick={() => setCustomModalForm({...customModalForm, price: customModalForm.price + 0.5})}><IconPlus /></button>
               </div>
             </div>
             
             <div className="modal-body" style={{marginTop: '0px'}}>
               <textarea 
                  value={customModalForm.name}
                  onChange={e => setCustomModalForm({...customModalForm, name: e.target.value})}
                  placeholder="Inserisci la descrizione..."
                  className="form-input"
                  style={{minHeight: '120px', resize: 'none', width: '100%', padding: '15px', boxSizing: 'border-box'}}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (customModalForm.name.trim() || customModalForm.price !== 0) {
                        handleAddCustom();
                      }
                    }
                  }}
                  autoFocus
               />
               <div style={{marginTop: '10px'}}>
                  <button 
                    onClick={handleAddCustom}
                    className="btn-success" 
                    style={{width: '100%'}}
                    disabled={!customModalForm.name.trim() && customModalForm.price === 0}
                  >
                    Aggiungi
                  </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* MODALE CLIENTI */}
      {customerModalOpen && (
        <div className="modal-overlay" onClick={() => setCustomerModalOpen(false)} style={{zIndex: 2010}}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h2>{customerForm.id ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
              {customerForm.id && (
                <button type="button" style={{padding: '6px', backgroundColor: '#f1f2f6', border: '1px solid #ced6e0', borderRadius: '8px', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)'}} title="Elimina" onClick={() => { setCustomerModalOpen(false); setCustomerToDelete(customerForm); }}>
                  <IconTrash />
                </button>
              )}
            </div>
            <form onSubmit={handleSaveCustomer} className="customer-form" style={{display: 'flex', flexDirection: 'column', gap: '15px'}} noValidate>
              <input type="text" placeholder="Nome o Riferimento" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} className="form-input" />
              <input type="text" placeholder="Telefono (es. 333...)" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="form-input" />
              <input type="text" placeholder="Indirizzo (es. Via Roma 1)" value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value})} className="form-input" />
              <input type="text" placeholder="Note (es. Intollerante Panna)" value={customerForm.notes} onChange={e => setCustomerForm({...customerForm, notes: e.target.value})} className="form-input" />
              <button type="submit" className={customerForm.id ? "btn-primary" : "btn-success"} style={{marginTop: '15px'}} disabled={loading}>{customerForm.id ? 'Salva Modifiche' : 'Salva Cliente'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODALE OPZIONI DI CONSEGNA */}
      {orderConfigModalOpen && (
        <div className="modal-overlay" onClick={() => setOrderConfigModalOpen(false)} style={{zIndex: 2000}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <div className="modal-body-scroll" style={{display: 'flex', flexDirection: 'column', gap: '20px', padding: '25px 0 10px 0', marginTop: '10px'}}>
              <div>
                <div style={{display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative', zIndex: 10}}>
                  <div style={{flex: 1, position: 'relative'}}>
                    <input 
                      type="text"
                      className="form-input"
                      placeholder="Cerca cliente (nome o telefono)..."
                      value={(selectedCustomer && !isCustomerSearchFocused) ? selectedCustomer.name : customerSearchQuery}
                      onChange={(e) => {
                         setCustomerSearchQuery(e.target.value);
                         setShowCustomerDropdown(true);
                       }}
                      onFocus={() => { setShowCustomerDropdown(true); setIsCustomerSearchFocused(true); }}
                      onBlur={() => setTimeout(() => { setShowCustomerDropdown(false); setIsCustomerSearchFocused(false); }, 200)}
                      style={{fontSize: '1.05rem', padding: '12px', margin: 0, fontWeight: 'bold'}}
                    />
                    
                    {/* Clear button in input if selected */}
                    {selectedCustomer && (
                      <button 
                        onClick={() => { setSelectedCustomer(null); setCustomerSearchQuery(''); }}
                        title="Rimuovi cliente"
                        style={{
                          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', 
                          backgroundColor: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', 
                          fontSize: '0.9rem', color: 'var(--text-dark)', borderRadius: '50%',
                          width: '26px', height: '26px', display: 'flex', alignItems: 'center', 
                          justifyContent: 'center', fontWeight: 'bold', transition: 'all 0.2s', padding: 0
                        }}
                      >
                        ✕
                      </button>
                    )}

                    {showCustomerDropdown && isCustomerSearchFocused && customerSearchQuery.trim() && (
                       <div style={{
                         position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                         backgroundColor: 'white', border: '1px solid var(--border-color)', 
                         borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                         }}>
                         {(() => {
                            const q = customerSearchQuery.toLowerCase();
                            const filtered = customers.filter(c => 
                              (c.name && c.name.toLowerCase().includes(q)) || 
                              (c.phone && c.phone.replace(/\s/g,'').includes(q.replace(/\s/g,''))) ||
                              (c.address && c.address.toLowerCase().includes(q))
                            ).slice(0, 5);

                            if (filtered.length === 0) {
                              return <div style={{padding: '12px', textAlign: 'center', color: 'var(--text-light)', fontStyle: 'italic'}}>Nessun cliente trovato per "{customerSearchQuery}".</div>;
                            }

                            return filtered.map(c => (
                              <div 
                                key={c.id} 
                                style={{padding: '12px', borderBottom: '1px solid #f1f2f6', cursor: 'pointer', textAlign: 'left'}}
                                onMouseDown={() => {
                                   setSelectedCustomer(c);
                                   setShowCustomerDropdown(false);
                                   setIsOrderConfigured(true);
                                }}
                              >
                                <div style={{fontWeight: 'bold', color: 'var(--text-dark)'}}>{c.name}{c.phone && <span style={{fontWeight: 'normal', color: 'var(--text-light)'}}> - {c.phone}</span>}</div>
                                {c.address && (
                                  <div style={{fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '2px'}}>
                                    {c.address}
                                  </div>
                                )}
                              </div>
                            ));
                         })()}
                       </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => { 
                      const cleanQuery = customerSearchQuery.trim();
                      setCustomerForm({ 
                        id: null, 
                        name: '', 
                        phone: cleanQuery, 
                        address: '', 
                        notes: '' 
                      }); 
                      setCustomerModalOpen(true); 
                    }} 
                    style={{backgroundColor: '#f1f2f6', border: '1px solid #dfe4ea', color: 'var(--text-dark)', padding: '0', width: '48px', height: '48px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', margin: 0, flexShrink: 0}} 
                    title="Nuovo Cliente"
                  >
                    <IconPlus />
                  </button>
                </div>
              </div>

              <div>
                <div style={{display: 'flex', gap: '10px'}}>
                  {['ASPORTO', 'DOMICILIO'].map(type => (
                    <button 
                      key={type}
                      className="modifier-btn"
                      onClick={() => {
                        setOrderType(type);
                        if (type === 'DOMICILIO' && deliveryFeeQuantity === 0) setDeliveryFeeQuantity(1);
                      }}
                      style={{flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold', backgroundColor: 'white', border: orderType === type ? '2px solid var(--primary-color)' : '2px solid var(--border-color)', color: 'var(--text-dark)'}}
                    >
                      {type === 'DOMICILIO' ? 'Consegna' : 'Asporto'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                <div style={{display: 'flex', gap: '10px'}}>
                  {['Pranzo', 'Cena'].map(slot => {
                    const isActive = slot === 'Pranzo' ? isLunchSlot : !isLunchSlot;
                    return (
                      <button 
                        key={slot}
                        className="modifier-btn"
                        type="button"
                        onClick={() => setIsLunchSlot(slot === 'Pranzo')}
                        style={{flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold', backgroundColor: 'white', border: isActive ? '2px solid var(--primary-color)' : '2px solid var(--border-color)', color: 'var(--text-dark)'}}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
                {(() => {
                  const pizzasPerSlot = orders.reduce((acc, order) => {
                    const time = order.delivery_time;
                    if (!time) return acc;
                    try {
                      const items = JSON.parse(order.items_json || '[]');
                      const pizzeCount = items.filter(i => i.category === 'pizze').reduce((sum, item) => sum + (item.quantity || 1), 0);
                      acc[time] = (acc[time] || 0) + pizzeCount;
                    } catch(e) {}
                    return acc;
                  }, {});

                  const checkIfTimeIsPast = (h, mStr) => {
                    const now = new Date();
                    const currH = now.getHours();
                    const currM = now.getMinutes();
                    const m = parseInt(mStr);
                    if (currH < 6) return true; // Se siamo dopo mezzanotte, la fascia 18-23 è letteralmente ieri
                    if (h < currH) return true;
                    if (h === currH && m < currM) return true;
                    return false;
                  };

                  return (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '5px'}}>
                      {(isLunchSlot ? [11, 12, 13, 14] : [18, 19, 20, 21]).map(h => {
                        return (
                          <div key={h} style={{display: 'grid', gridTemplateColumns: '1.4fr repeat(5, 1fr)', gap: '6px'}}>
                            {['00', '10', '20', '30', '40', '50'].map(m => {
                              if (isLunchSlot && h === 14 && parseInt(m) > 30) return <div key={`${h}-${m}`}></div>;
                              const time = `${h}:${m}`;
                              const isPast = checkIfTimeIsPast(h, m);
                              const load = pizzasPerSlot[time] || 0;
                              const isLoaded = load >= 10;
                              const isSelected = deliveryTime === time;

                              let bg = 'white';
                              let text = 'var(--text-dark)';
                              let border = '2px solid #dfe4ea';

                              if (isPast) {
                                bg = '#f8f9fa';
                                text = '#bdc3c7';
                                border = '2px solid #f8f9fa';
                              }

                              if (isSelected) {
                                border = '2px solid var(--primary-color)';
                              }

                              return (
                                <button
                                  key={time}
                                  disabled={isPast}
                                  onClick={() => setDeliveryTime(time)}
                                  title={isLoaded ? `ATTENZIONE: Hai già raggiunto ${load} pizze in questa fascia!` : ''}
                                    style={{
                                      padding: '10px 4px 10px 8px', 
                                      fontSize: '1rem', 
                                      fontWeight: 'bold', 
                                      borderRadius: '6px', 
                                      boxShadow: 'none',
                                      cursor: isPast ? 'not-allowed' : 'pointer',
                                    backgroundColor: bg,
                                    color: text,
                                    border: border,
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '50px',
                                    position: 'relative'
                                  }}
                                >
                                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 4px', boxSizing: 'border-box'}}>
                                    <div style={{lineHeight: '1', textAlign: 'left'}}>{m === '00' ? time : `:${m}`}</div>
                                    {!isPast && (
                                      <div style={{
                                        backgroundColor: load === 0 ? 'white' : (load <= 10 ? '#f1f2f6' : 'rgba(255, 94, 58, 0.15)'),
                                        border: load === 0 ? '1px solid #dfe4ea' : (load <= 10 ? '1px solid var(--text-dark)' : '1px solid var(--primary-color)'),
                                        color: load === 0 ? '#bdc3c7' : (load <= 10 ? 'var(--text-dark)' : 'var(--primary-color)'),
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0',
                                        fontWeight: 'bold',
                                        boxSizing: 'border-box'
                                      }}>
                                        {load}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div style={{display: 'flex', gap: '10px'}}>
                  {['CASH', 'CARD'].map(type => (
                    <button 
                      key={type}
                      className="modifier-btn"
                      onClick={() => setPaymentType(type)}
                      style={{flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold', backgroundColor: 'white', border: paymentType === type ? '2px solid var(--primary-color)' : '2px solid var(--border-color)', color: 'var(--text-dark)'}}
                    >
                      {type === 'CASH' ? 'Contanti' : 'POS / Carta'}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn-success" onClick={() => { setOrderConfigModalOpen(false); setIsOrderConfigured(true); }}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEZIONE SINISTRA - MENU E BACKOFFICE */}
      <section key={`menu-section-${mainView}`} className={`menu-section ${mainView === 'MENU' ? 'slide-in-right' : 'slide-in-left'}`} style={{ flex: mainView === 'BACKOFFICE' ? 'none' : 1, width: mainView === 'BACKOFFICE' ? '100%' : 'auto' }}>
        
        <div className="category-tabs" style={{alignItems: 'center', marginTop: '20px', justifyContent: mainView === 'MENU' ? 'center' : 'flex-start'}}>
          {(mainView === 'MENU' ? CATEGORIES_MENU : CATEGORIES_BACKOFFICE).map(cat => (
            <button 
              key={cat.id} 
              className={`tab-btn ${activeTab === cat.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(cat.id); }}
            >
              {cat.label}
            </button>
          ))}
          {mainView === 'BACKOFFICE' && activeTab === 'ordini' && (
            <button 
              className="tab-btn tab-btn-success" 
              style={{marginLeft: 'auto'}}
              onClick={() => setShowCloseDayModal(true)} 
              disabled={loading}
              title="Azzera gli incassi e pulisci gli ordini per la serata corrente"
            >
              Chiusura Fiscale
            </button>
          )}
          {mainView === 'BACKOFFICE' && activeTab === 'clienti' && (
            <button 
              className="tab-btn" 
              style={{marginLeft: 'auto'}}
              onClick={() => { setCustomerForm({ id: null, name: '', phone: '', address: '', notes: '' }); setCustomerModalOpen(true); }}
            >
              + Nuovo Cliente
            </button>
          )}
        </div>

        {activeTab === 'ordini' ? (
          <div key="orders-container" className="orders-view" style={{marginTop: '24px'}}>


            <div style={{display: 'flex', gap: '15px', marginBottom: '36px', alignItems: 'center', flexWrap: 'wrap'}}>
               <div style={{display: 'flex', gap: '10px'}}>
                 <button 
                   onClick={() => {
                     if (orderSortBy === 'time') setOrderSortDirection(d => d === 'desc' ? 'asc' : 'desc');
                     else { setOrderSortBy('time'); setOrderSortDirection('desc'); }
                   }}
                   style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', fontSize: '1.05rem', borderRadius: '8px', border: orderSortBy === 'time' ? '2px solid var(--text-dark)' : '2px solid #ced6e0', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'white', color: orderSortBy === 'time' ? 'var(--text-dark)' : 'var(--text-light)', transition: 'all 0.2s'}}
                 >Orario {orderSortBy === 'time' && (orderSortDirection === 'desc' ? '↓' : '↑')}</button>
                 <button 
                   onClick={() => {
                     if (orderSortBy === 'id') setOrderSortDirection(d => d === 'desc' ? 'asc' : 'desc');
                     else { setOrderSortBy('id'); setOrderSortDirection('desc'); }
                   }}
                   style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', fontSize: '1.05rem', borderRadius: '8px', border: orderSortBy === 'id' ? '2px solid var(--text-dark)' : '2px solid #ced6e0', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'white', color: orderSortBy === 'id' ? 'var(--text-dark)' : 'var(--text-light)', transition: 'all 0.2s'}}
                 >Ordine {orderSortBy === 'id' && (orderSortDirection === 'desc' ? '↓' : '↑')}</button>
               </div>
               
               <div style={{display: 'flex', flex: 1, minWidth: '250px', position: 'relative'}}>
                 <input 
                   type="text" 
                   placeholder="Cerca per nome o indirizzo..." 
                   value={orderFilterName}
                   onChange={e => setOrderFilterName(e.target.value)}
                   className="form-input"
                   style={{padding: '12px 35px 12px 15px'}}
                 />
                 {orderFilterName && (
                   <button 
                     onClick={() => setOrderFilterName('')}
                     title="Azzera ricerca"
                     style={{
                       position: 'absolute', 
                       right: '10px', 
                       top: '50%', 
                       transform: 'translateY(-50%)', 
                       backgroundColor: 'rgba(0,0,0,0.06)', 
                       border: 'none', 
                       cursor: 'pointer', 
                       fontSize: '0.9rem', 
                       color: 'var(--text-dark)', 
                       borderRadius: '50%',
                       width: '26px',
                       height: '26px',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       fontWeight: 'bold',
                       transition: 'all 0.2s',
                       padding: 0
                     }}
                   >
                     ✕
                   </button>
                 )}
               </div>
               <button 
                 onClick={() => setOrderFilterPOS(!orderFilterPOS)}
                 style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', fontSize: '1.05rem', borderRadius: '8px', border: orderFilterPOS ? '2px solid var(--primary-color)' : '2px solid #ced6e0', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'white', color: orderFilterPOS ? 'var(--text-dark)' : 'var(--text-light)', transition: 'all 0.2s'}}
                 title="Filtra per Pagamento POS"
               >POS</button>
               <button 
                 onClick={() => setOrderFilterDelivery(!orderFilterDelivery)}
                 style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', fontSize: '1.05rem', borderRadius: '8px', border: orderFilterDelivery ? '2px solid var(--primary-color)' : '2px solid #ced6e0', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'white', color: orderFilterDelivery ? 'var(--text-dark)' : 'var(--text-light)', transition: 'all 0.2s'}}
                 title="Filtra per consegne a Domicilio"
               ><IconMoto /></button>
            </div>

            <div className="orders-grid" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              {(() => {
                // Filtro Globale prima del raggruppamento
                let filteredOrders = [...orders];
                if (orderFilterName.trim()) {
                  const term = orderFilterName.toLowerCase();
                  filteredOrders = filteredOrders.filter(o => {
                    const c = customers.find(cust => cust.id === o.customer_id);
                    const name = c ? c.name.toLowerCase() : '';
                    const address = c && c.address ? c.address.toLowerCase() : '';
                    return name.includes(term) || address.includes(term) || String(o.id).includes(term);
                  });
                }
                if (orderFilterPOS) {
                  filteredOrders = filteredOrders.filter(o => o.payment_method === 'CARD');
                }
                if (orderFilterDelivery) {
                  filteredOrders = filteredOrders.filter(o => o.order_type === 'DOMICILIO');
                }
                
                if (filteredOrders.length === 0 && orders.length > 0) {
                  return <div style={{width: '100%', textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)', fontSize: '1.2rem', fontStyle: 'italic'}}>Nessun ordine trovato per "{orderFilterName}".</div>;
                }
                if (orders.length === 0) {
                  return <div style={{color: 'var(--text-dark)', padding: '20px', textAlign: 'center'}}>Nessun ordine presente a sistema.</div>;
                }

                if (orderSortBy === 'id') {
                  const sortedById = filteredOrders.sort((a, b) => orderSortDirection === 'asc' ? a.id - b.id : b.id - a.id);
                  return sortedById.map(o => renderOrderCard(o));
                }

                // Raggruppo per orario
                const groupedOrders = filteredOrders.reduce((acc, order) => {
                  const time = order.delivery_time || 'Senza Orario';
                  if (!acc[time]) acc[time] = [];
                  acc[time].push(order);
                  return acc;
                }, {});

                const sortedTimes = Object.keys(groupedOrders).sort((a, b) => {
                  if (a === 'Senza Orario') return 1;
                  if (b === 'Senza Orario') return -1;
                  return orderSortDirection === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
                });

                return sortedTimes.map(timeGroup => {
                  const groupTotalPizze = groupedOrders[timeGroup].reduce((total, o) => {
                    try {
                      const items = JSON.parse(o.items_json || '[]');
                      return total + items.filter(i => i.category === 'pizze').reduce((sum, item) => sum + (item.quantity || 1), 0);
                    } catch(e) { return total; }
                  }, 0);

                  return (
                  <div key={timeGroup} className="order-time-group" style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px', 
                    marginBottom: '15px' 
                  }}>
                    
                    {/* Intestazione Orario Allineata */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                       <div style={{
                         backgroundColor: '#f1f2f6',
                         color: 'var(--text-dark)',
                         border: '2px solid #ced6e0',
                         fontWeight: 'bold',
                         fontSize: timeGroup === 'Senza Orario' ? '0.9rem' : '1.1rem',
                         padding: '6px 14px',
                         borderRadius: '8px',
                         display: 'inline-block'
                       }}>
                         {timeGroup === 'Senza Orario' ? 'In Attesa' : timeGroup}
                       </div>
                       
                       {groupTotalPizze > 0 && (
                         <div style={{
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           width: timeGroup === 'Senza Orario' ? '30px' : '36px',
                           height: timeGroup === 'Senza Orario' ? '30px' : '36px',
                           borderRadius: '50%',
                           border: '2px solid #ced6e0',
                           color: 'var(--text-dark)',
                           fontSize: timeGroup === 'Senza Orario' ? '0.9rem' : '1.1rem',
                           fontWeight: 'bold',
                           marginLeft: '10px',
                           backgroundColor: '#f1f2f6',
                           flexShrink: 0
                         }} title={`${groupTotalPizze} pizze in questa fascia oraria`}>
                           {groupTotalPizze}
                         </div>
                       )}

                       <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)', marginLeft: '15px' }}></div>
                    </div>

                    {/* Elenco Ordini di quell'orario */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {groupedOrders[timeGroup].sort((a, b) => orderSortDirection === 'asc' ? a.id - b.id : b.id - a.id).map(o => renderOrderCard(o))}
                    </div>
                  </div>
                  );
                });
              })()}
            </div>
          </div>
        ) : activeTab === 'clienti' ? (
          <div key="customers-container" className="customers-view" style={{marginTop: '24px'}}>
            {(() => {
              const filteredCustomers = customers.filter(c => {
                if (!customerFilter) return true;
                const searchStr = customerFilter.toLowerCase();
                return (c.name && c.name.toLowerCase().includes(searchStr)) || 
                       (c.address && c.address.toLowerCase().includes(searchStr)) ||
                       (c.phone && c.phone.toLowerCase().includes(searchStr));
              }).sort((a, b) => {
                let valA = a[customerSortBy] || '';
                let valB = b[customerSortBy] || '';
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return customerSortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return customerSortDirection === 'asc' ? 1 : -1;
                return 0;
              });

              return (
                <>
                  <div style={{display: 'flex', gap: '15px', marginBottom: '36px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <div style={{display: 'flex', gap: '10px'}}>
                      <button 
                        onClick={() => {
                          if (customerSortBy === 'name') setCustomerSortDirection(d => d === 'desc' ? 'asc' : 'desc');
                          else { setCustomerSortBy('name'); setCustomerSortDirection('asc'); }
                        }}
                        style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', fontSize: '1.05rem', borderRadius: '8px', border: customerSortBy === 'name' ? '2px solid var(--text-dark)' : '2px solid #ced6e0', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'white', color: customerSortBy === 'name' ? 'var(--text-dark)' : 'var(--text-light)', transition: 'all 0.2s'}}
                      >Nome {customerSortBy === 'name' && (customerSortDirection === 'desc' ? '↓' : '↑')}</button>
                      <button 
                        onClick={() => {
                          if (customerSortBy === 'address') setCustomerSortDirection(d => d === 'desc' ? 'asc' : 'desc');
                          else { setCustomerSortBy('address'); setCustomerSortDirection('asc'); }
                        }}
                        style={{display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', fontSize: '1.05rem', borderRadius: '8px', border: customerSortBy === 'address' ? '2px solid var(--text-dark)' : '2px solid #ced6e0', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'white', color: customerSortBy === 'address' ? 'var(--text-dark)' : 'var(--text-light)', transition: 'all 0.2s'}}
                      >Indirizzo {customerSortBy === 'address' && (customerSortDirection === 'desc' ? '↓' : '↑')}</button>
                    </div>
                    
                    <div style={{display: 'flex', flex: 1, minWidth: '250px', position: 'relative'}}>
                      <input 
                        type="text" 
                        placeholder="Cerca per nome, telefono o indirizzo..." 
                        value={customerFilter}
                        onChange={e => setCustomerFilter(e.target.value)}
                        className="form-input"
                        style={{padding: '12px 35px 12px 15px'}}
                      />
                      {customerFilter && (
                        <button 
                          onClick={() => setCustomerFilter('')}
                          title="Azzera ricerca"
                          style={{
                            position: 'absolute', 
                            right: '10px', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            backgroundColor: 'rgba(0,0,0,0.06)', 
                            border: 'none', 
                            cursor: 'pointer', 
                            fontSize: '0.9rem', 
                            color: 'var(--text-dark)', 
                            borderRadius: '50%',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            transition: 'all 0.2s',
                            padding: 0
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredCustomers.map(c => (
                      <div 
                        key={c.id} 
                        style={{
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '12px 18px', 
                          backgroundColor: 'white', 
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          border: '1px solid #eaeaea',
                          cursor: 'pointer'
                        }}
                        onClick={() => { setCustomerForm(c); setCustomerModalOpen(true); }}
                        title="Clicca per visualizzare o modificare la scheda cliente"
                      >
                        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', flex: 1}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: 'var(--text-dark)'}}>
                            <span style={{fontWeight: 'bold'}}>{c.name}</span>
                            {(c.phone || c.address) && (
                              <span style={{fontSize: '0.95rem', color: 'var(--text-light)'}}>
                                - {c.phone} {c.phone && c.address ? ' - ' : ''} {c.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredCustomers.length === 0 && (
                    <div style={{width: '100%', textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)', fontSize: '1.2rem', fontStyle: 'italic'}}>
                      {customers.length === 0 ? 'Nessun cliente registrato in rubrica.' : `Nessun cliente trovato per "${customerFilter}".`}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div key="menu-container" className="menu-grid">
            {activeTab === 'pizze' && (
              <div 
                className="menu-item" 
                onClick={handleAddFamilyPizza}
              >
                <div className="item-name">Famiglia</div>
              </div>
            )}
            {displayedItems.map(item => (
              <div key={item.id} className="menu-item" onClick={() => addToCart(item)}>
                <div className="item-name">{item.name}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEZIONE DESTRA - CARRELLO/CASSA */}
      {mainView === 'MENU' && (
      <section key="cart-section" className="cart-section slide-in-right">
        {/* CARRELLO HEADER: RIEPILOGO CONSEGNA CLICCABILE */}
        <div 
          onClick={() => setOrderConfigModalOpen(true)}
          style={{backgroundColor: '#f1f2f6', borderRadius: '8px', padding: !isOrderConfigured ? '12px' : '8px', margin: !isOrderConfigured ? '39px 24px 15px 24px' : '39px 24px 10px 24px', color: 'var(--text-dark)', border: '1px solid #dfe4ea', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: !isOrderConfigured ? '60px' : 'auto'}}
          title="Clicca per modificare modalità, orario o cliente"
        >
          {!isOrderConfigured ? (
             <div style={{fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary-color)'}}>
                + Crea nuovo ordine
             </div>
          ) : (
             <div style={{width: '100%'}}>
               <div style={{display: 'flex', alignItems: 'center', borderBottom: '1px solid #dfe4ea', paddingBottom: '4px', marginBottom: '4px'}}>
                <div style={{flex: 1, fontWeight: 'bold', fontSize: '1.05rem', textAlign: 'left'}}>
                   {orderType === 'DOMICILIO' ? 'Consegna' : 'Asporto'}
                </div>
                <div style={{flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '1.05rem'}}>
                   {(orderType === 'DOMICILIO' && paymentType === 'CARD') && (
                      <span style={{color: 'var(--primary-color)'}}>POS</span>
                   )}
                </div>
                <div style={{flex: 1, textAlign: 'right'}}>
                   <div style={{fontSize: '1.05rem', fontWeight: 'bold'}}>
                      {deliveryTime || getNearest10MinSlot()}
                   </div>
                </div>
              </div>
             
             <div style={{textAlign: 'left', width: '100%', padding: '0 2px'}}>
                {selectedCustomer && (
                  <div style={{marginTop: '2px'}}>
                    <div style={{fontWeight: 'bold', fontSize: '1.05rem'}}>
                       {selectedCustomer.name}
                    </div>
                    {selectedCustomer.phone && (
                      <div style={{fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0px'}}>
                        {selectedCustomer.phone}
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div style={{fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0px'}}>
                        {selectedCustomer.address}
                      </div>
                    )}
                    {selectedCustomer.notes && (
                      <div style={{fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0px', fontStyle: 'italic'}}>
                        {selectedCustomer.notes}
                      </div>
                    )}
                  </div>
                )}
             </div>
           </div>
          )}
        </div>

        <div className="cart-items">
          {cart.length === 0 && !(orderType === 'DOMICILIO' && deliveryFeeQuantity > 0) ? (
            <div className="cart-empty">Nessun prodotto...</div>
          ) : (
            <>
              {/* Spese di Consegna renderizzate IN ALTO */}
              {orderType === 'DOMICILIO' && deliveryFeeQuantity > 0 && (
                <div className="cart-item" style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch', cursor: 'default'}}>
                  {/* RIGA 1: Nome, Qty, Prezzo sulla stessa riga */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                    {/* Nome */}
                    <div className="cart-item-name" style={{flex: 1, textAlign: 'left', fontWeight: 'bold'}}>Spese di Consegna</div>
                    
                    {/* Quantità dinamica */}
                    <div className="cart-item-controls" style={{display: 'flex', alignItems: 'center', margin: '0 10px', flexShrink: 0}}>
                      <button className="qty-btn" onClick={(e) => { e.stopPropagation(); setDeliveryFeeQuantity(q => Math.max(0, q - 1)); }}><IconMinus /></button>
                      <span className="qty-text" style={{margin: '0', fontWeight: 'bold', width: '28px', textAlign: 'center', display: 'inline-block'}}>{deliveryFeeQuantity}</span>
                      <button className="qty-btn" onClick={(e) => { e.stopPropagation(); setDeliveryFeeQuantity(q => q + 1); }}><IconPlus /></button>
                    </div>

                    {/* Prezzo */}
                    <div className="cart-item-price" style={{width: '75px', textAlign: 'right', fontWeight: 'bold', margin: '0', flexShrink: 0}}>
                      € {(2.00 * deliveryFeeQuantity).toFixed(2)}
                    </div>
                  </div>
                  
                  {/* RIGA 2: Azioni */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6px', width: '100%'}}>
                    <div style={{flex: 1, textAlign: 'left'}}></div>
                    
                    <div className="cart-item-actions" style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                    </div>
                  </div>
                </div>
              )}

              {/* Prodotti del Carrello */}
              {[...cart].sort((a, b) => {
                const aNote = a.category === 'altro' && a.price === 0;
                const bNote = b.category === 'altro' && b.price === 0;
                if (aNote && !bNote) return 1;
                if (!aNote && bNote) return -1;
                return 0;
               }).map(item => item.isFamily ? (
                <div key={item.cartId} className="cart-item" style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}>
                  {/* RIGA 1: Titolo Pizza Famiglia */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                    <div className="cart-item-name" style={{flex: 1, textAlign: 'left', fontWeight: 'bold'}}>{item.name}</div>
                    <div className="cart-item-controls" style={{display: 'flex', alignItems: 'center', margin: '0 10px', flexShrink: 0}}>
                      <button className="qty-btn" onClick={(e) => { e.stopPropagation(); item.quantity > 1 ? updateQuantity(item.cartId, -1) : removeItem(item.cartId); }}><IconMinus /></button>
                      <span className="qty-text" style={{margin: '0', fontWeight: 'bold', width: '28px', textAlign: 'center', display: 'inline-block'}}>{item.quantity}</span>
                      <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartId, 1); }}><IconPlus /></button>
                    </div>
                    <div className="cart-item-price" style={{width: '75px', textAlign: 'right', fontWeight: 'bold', margin: '0', flexShrink: 0}}>
                      € {(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                  {/* METÀ 1 */}
                  <div 
                    onClick={(e) => {
                       e.stopPropagation();
                       if (item.halves[0]) { setFamilyHalfIndex(0); setEditingItem(item); } 
                       else { setSelectingHalfFor({ cartId: item.cartId, halfIndex: 0 }); }
                    }}
                    style={{
                      border: !item.halves[0] ? '1px dashed #ced6e0' : 'none',
                      padding: !item.halves[0] ? '8px' : '4px 0',
                      marginTop: '12px', borderRadius: '6px', cursor: 'pointer',
                      backgroundColor: !item.halves[0] ? 'white' : 'transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    {!item.halves[0] ? (
                      <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center'}}>+ Scegli 1° Gusto</div>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', textAlign: 'left'}}>
                         <div style={{fontWeight: 'bold', fontSize: '0.95rem'}}>½ {item.halves[0].name}</div>
                         <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.85rem'}}>{formatModifiers(item.halves[0].modifiers, 0)}</div>
                      </div>
                    )}
                  </div>
                  {/* METÀ 2 */}
                  {item.halves[0] && (
                    <div 
                      onClick={(e) => {
                         e.stopPropagation();
                         if (item.halves[1]) { setFamilyHalfIndex(1); setEditingItem(item); } 
                         else { setSelectingHalfFor({ cartId: item.cartId, halfIndex: 1 }); }
                      }}
                      style={{
                        border: !item.halves[1] ? '1px dashed #ced6e0' : 'none',
                        padding: !item.halves[1] ? '8px' : '4px 0',
                        marginTop: '6px', borderRadius: '6px', cursor: 'pointer',
                        backgroundColor: !item.halves[1] ? 'white' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      {!item.halves[1] ? (
                         <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center'}}>+ Scegli 2° Gusto</div>
                      ) : (
                        <div style={{display: 'flex', flexDirection: 'column', textAlign: 'left'}}>
                           <div style={{fontWeight: 'bold', fontSize: '0.95rem'}}>½ {item.halves[1].name}</div>
                           <div style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.85rem'}}>{formatModifiers(item.halves[1].modifiers, 0)}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* EVENTUALE SOVRAPREZZO SULLA FAMIGLIA INTERA */}
                  {item.manualPriceDelta !== 0 && (
                    <div style={{textAlign: 'left', marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-light)', fontStyle: 'italic'}}>
                      {item.manualPriceDelta > 0 ? `Sovrapprezzo (+${item.manualPriceDelta.toFixed(2)}€)` : `Sconto (${item.manualPriceDelta.toFixed(2)}€)`}
                    </div>
                  )}
                </div>
              ) : (
              <div key={item.cartId} className="cart-item" onClick={() => openEditor(item)} style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch', cursor: item.category === 'pizze' ? 'pointer' : 'default'}}>
                {/* RIGA 1: Nome, Qty, Prezzo sulla stessa riga */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                  {/* Nome (allineato a sinistra) */}
                  <div className="cart-item-name" style={{flex: 1, textAlign: 'left', fontWeight: 'bold'}}>{item.name}</div>
                  
                  {/* Quantità (centrale/destra) */}
                  <div className="cart-item-controls" style={{display: 'flex', alignItems: 'center', margin: '0 10px', flexShrink: 0}}>
                    <button className="qty-btn" onClick={(e) => { e.stopPropagation(); item.quantity > 1 ? updateQuantity(item.cartId, -1) : removeItem(item.cartId); }}><IconMinus /></button>
                    <span className="qty-text" style={{margin: '0', fontWeight: 'bold', width: '28px', textAlign: 'center', display: 'inline-block'}}>{item.quantity}</span>
                    <button className="qty-btn" onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartId, 1); }}><IconPlus /></button>
                  </div>

                  {/* Prezzo (allineato a destra) */}
                  <div className="cart-item-price" style={{width: '75px', textAlign: 'right', fontWeight: 'bold', margin: '0', flexShrink: 0}}>
                    {item.category === 'altro' && item.price === 0 ? '' : `€ ${(item.price * item.quantity).toFixed(2)}`}
                  </div>
                </div>
                
                {/* RIGA 2: Modifiche, Azioni */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6px', width: '100%'}}>
                  {/* Modifiche (allineate a sinistra sotto il nome) */}
                  <div style={{flex: 1, textAlign: 'left'}}>
                    {(() => {
                      const strMods = formatModifiers(item.modifiers, item.manualPriceDelta);
                      if (strMods) {
                        return (
                          <div className="cart-item-modifiers" style={{color: 'var(--text-light)', fontStyle: 'italic', fontSize: '0.85rem'}}>
                             {strMods}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  
                  {/* Azioni (rimosse in favore del pulsante '-') */}
                  <div className="cart-item-actions" style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                  </div>
                </div>
              </div>
              ))}
            </>
          )}

          <div ref={cartEndRef} />
        </div>

        <div style={{padding: '0 24px', marginBottom: '15px'}}>
            <button 
              onClick={() => { 
                setCustomModalContext('ORDER');
                setCustomModalForm({name: '', price: 0}); 
                setCustomModalOpen(true); 
              }}
              style={{
                width: '100%',
                backgroundColor: 'white', 
                border: '2px dashed #dfe4ea', 
                borderRadius: '8px', 
                padding: '12px', 
                color: 'var(--text-dark)', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              + Aggiunta Libera
            </button>
          </div>

        <div className="cart-footer">
          <div className="totals-row grand-total">
            <span>Totale:</span>
            <span>€ {cartTotal.toFixed(2)}</span>
          </div>

          <div className="action-buttons" style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn-success" 
              onClick={() => { handlePrintTicket(); handleSaveOrder(); }} 
              disabled={cart.length === 0 || loading}
              style={{ flex: 1.5, padding: '16px', fontSize: '1.1rem', fontWeight: 'bold' }}
            >
              Stampa Ordine
            </button>
            <button 
              className="btn-secondary" 
              onClick={handleSaveOrder} 
              disabled={cart.length === 0 || loading}
              style={{ flex: 1, padding: '12px', fontSize: '0.95rem', fontWeight: 'bold' }}
            >
              {editingOrderId ? 'Salva Modifiche' : 'Salva'}
            </button>
          </div>
        </div>
      </section>
      )}
    </div>
  );
}

export default App;
