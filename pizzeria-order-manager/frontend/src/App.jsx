import React, { useState } from 'react';
import './App.css';

const MENU_ITEMS = [
  { id: 1, name: 'Margherita', price: 6.00, category: 'pizze', icon: '🍕' },
  { id: 2, name: 'Marinara', price: 5.00, category: 'pizze', icon: '🍕' },
  { id: 3, name: 'Diavola', price: 7.50, category: 'pizze', icon: '🍕' },
  { id: 4, name: 'Capricciosa', price: 8.50, category: 'pizze', icon: '🍕' },
  { id: 5, name: 'Bufalina', price: 9.00, category: 'pizze', icon: '🍕' },
  
  { id: 6, name: 'Coca Cola', price: 3.00, category: 'bevande', icon: '🥤' },
  { id: 7, name: 'Birra Media', price: 5.00, category: 'bevande', icon: '🍺' },
  { id: 8, name: 'Acqua Naturale', price: 2.00, category: 'bevande', icon: '💧' },
  
  { id: 9, name: 'Tiramisù', price: 5.00, category: 'dolci', icon: '🍰' },
  { id: 10, name: 'Panna Cotta', price: 4.50, category: 'dolci', icon: '🍮' },
];

const CATEGORIES = [
  { id: 'tutte', label: 'TuttoMenu' },
  { id: 'pizze', label: 'Pizze' },
  { id: 'bevande', label: 'Bevande' },
  { id: 'dolci', label: 'Dolci' },
];

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [activeTab, setActiveTab] = useState('tutte');
  const [cart, setCart] = useState([]);
  const [paymentType, setPaymentType] = useState('CASH');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  const displayedItems = activeTab === 'tutte' 
    ? MENU_ITEMS 
    : MENU_ITEMS.filter(item => item.category === activeTab);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeItem = (id) => setCart(prev => prev.filter(item => item.id !== id));

  // --- Funzioni API ---
  const handlePrintTicket = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/print-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: Date.now().toString().slice(-6),
          table: 'Asporto',
          orderItems: cart
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

  const handlePrintReceipt = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: Date.now().toString().slice(-6),
          total: cartTotal,
          paymentType,
          orderItems: cart
        }),
      });
      if (!res.ok) throw new Error('Errore server');
      showNotification('Scontrino Fiscale emesso!');
      setCart([]); // Svuota cassa al termine
    } catch (err) {
      showNotification('Errore K3 Custom', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    if(!window.confirm('Sei sicuro di voler effettuare la chiusura fiscale Z?')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/close-day`, { method: 'POST' });
      if (!res.ok) throw new Error('Errore server');
      showNotification('Chiusura Fiscale Z completata!');
    } catch (err) {
      showNotification('Errore Chiusura K3 Custom', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pos-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* SEZIONE SINISTRA - MENU */}
      <section className="menu-section">
        <header className="header">
          <h1>🍕 Pizzeria Manager</h1>
          <button className="btn-close-day" onClick={handleCloseDay} disabled={loading}>
            Chiusura Fiscale (Z)
          </button>
        </header>

        <div className="category-tabs">
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id} 
              className={`tab-btn ${activeTab === cat.id ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="menu-grid">
          {displayedItems.map(item => (
            <div key={item.id} className="menu-item" onClick={() => addToCart(item)}>
              <div className="item-icon">{item.icon}</div>
              <div className="item-name">{item.name}</div>
              <div className="item-price">€ {item.price.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SEZIONE DESTRA - CARRELLO/CASSA */}
      <section className="cart-section">
        <div className="cart-header">
          <h2>Nuovo Ordine</h2>
          {cart.length > 0 && (
             <button className="btn-clear" onClick={() => setCart([])}>Svuota</button>
          )}
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">Nessun prodotto aggiunto...</div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">€ {(item.price * item.quantity).toFixed(2)}</div>
                </div>
                <div className="cart-item-controls">
                  <button className="qty-btn" onClick={() => item.quantity > 1 ? updateQuantity(item.id, -1) : removeItem(item.id)}>-</button>
                  <span className="qty-text">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="payment-method">
            <button 
              className={`payment-btn ${paymentType === 'CASH' ? 'active' : ''}`}
              onClick={() => setPaymentType('CASH')}>Contanti
            </button>
            <button 
              className={`payment-btn ${paymentType === 'CARD' ? 'active' : ''}`}
              onClick={() => setPaymentType('CARD')}>Carta / POS
            </button>
          </div>

          <div className="totals-row grand-total">
            <span>Totale:</span>
            <span>€ {cartTotal.toFixed(2)}</span>
          </div>

          <div className="action-buttons">
            <button className="btn-secondary" onClick={handlePrintTicket} disabled={cart.length === 0 || loading}>
              🖨️ Stampa Comanda Cucina (Epson)
            </button>
            <button className="btn-primary" onClick={handlePrintReceipt} disabled={cart.length === 0 || loading}>
              🧾 Emetti Scontrino Fiscale (Custom K3)
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
