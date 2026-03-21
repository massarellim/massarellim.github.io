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
  { id: 'tutte', label: 'Tutto' },
  { id: 'pizze', label: 'Pizze' },
  { id: 'bevande', label: 'Bevande' },
  { id: 'dolci', label: 'Dolci' },
];

const INGREDIENT_MODIFIERS = [
  // Aggiunte +2€
  { label: '+ Crudo Parma (+2€)', value: '+ Crudo Parma', price: 2.0 },
  { label: '+ Speck (+2€)', value: '+ Speck i.g.p.', price: 2.0 },
  { label: '+ Bresaola (+2€)', value: '+ Bresaola', price: 2.0 },
  { label: '+ Noci (+2€)', value: '+ Noci', price: 2.0 },
  { label: '+ Porcini (+2€)', value: '+ Funghi porcini', price: 2.0 },
  { label: '+ Bufala DOP (+2€)', value: '+ Mozzarella Bufala DOP', price: 2.0 },
  { label: '+ Frutti di Mare (+2€)', value: '+ Frutti di Mare', price: 2.0 },
  { label: '+ Gamberetti (+2€)', value: '+ Mazzancolle', price: 2.0 },
  { label: '+ Salmone (+2€)', value: '+ Salmone affumicato', price: 2.0 },
  
  // Aggiunte +1.5€
  { label: '+ Grana DOP (+1.5€)', value: '+ Grana Padano DOP', price: 1.5 },
  { label: '+ Tonno (+1.5€)', value: '+ Tonno', price: 1.5 },
  { label: '+ Salame nost. (+1.5€)', value: '+ Salame nostrano', price: 1.5 },
  { label: '+ Provolone (+1.5€)', value: '+ Provolone aff.', price: 1.5 },
  { label: '+ Verd. Grigliate (+1.5€)', value: '+ Verdure grigliate', price: 1.5 },
  { label: '+ Pancetta (+1.5€)', value: '+ Pancetta affumicata', price: 1.5 },
  { label: '+ Pomodorini (+1.5€)', value: '+ Pomodorini', price: 1.5 },
  { label: '+ Friarielli (+1.5€)', value: '+ Trevisana/Friarielli', price: 1.5 },
  
  // Aggiunte +1€
  { label: '+ Altro Ingr. (+1€)', value: '+ Altro (Tutto il resto)', price: 1.0 },

  // Aggiunte +0.5€
  { label: '+ Pomodoro (+0.5€)', value: '+ Pomodoro', price: 0.5 },
  { label: '+ Mozzarella (+0.5€)', value: '+ Mozzarella extra', price: 0.5 },
  { label: '+ Capperi (+0.5€)', value: '+ Capperi', price: 0.5 },
  { label: '+ Panna (+0.5€)', value: '+ Panna', price: 0.5 },
  { label: '+ Rucola (+0.5€)', value: '+ Rucola', price: 0.5 },
  { label: '+ Salse (+0.5€)', value: '+ Maionese/Ketchup', price: 0.5 },

  // Speciali
  { label: 'Impasto Integrale (+1€)', value: 'Farina integrale', price: 1.0 },
  { label: 'Senza Lattosio (+1.5€)', value: 'Mozzarella Senza Lattosio', price: 1.5 },
  { label: 'BIG PIZZA (+2€)', value: 'BIG PIZZA', price: 2.0 },
  { label: 'In vaschetta (+0.5€)', value: 'Aggiunte in vaschetta', price: 0.5 },

  // Rimozioni e Cottura
  { label: '- Mozzarella', value: '- Mozzarella', price: 0 },
  { label: '- Pomodoro', value: '- Pomodoro', price: 0 },
  { label: '- Basilico', value: '- Basilico', price: 0 },
  { label: 'Ben Cotta', value: 'Ben cotta', price: 0 },
];

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [activeTab, setActiveTab] = useState('tutte');
  const [cart, setCart] = useState([]);
  const [paymentType, setPaymentType] = useState('CASH');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const displayedItems = activeTab === 'tutte' 
    ? MENU_ITEMS 
    : MENU_ITEMS.filter(item => item.category === activeTab);

  // Calcola totale dinamico tenendo conto dei modificatori
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addToCart = (product) => {
    // Al posto di accumulare sulla stessa riga, generiamo un cartId univoco.
    // Questo permette di modificare indipendentemente ogni pizza.
    // Per le bevande o identici potremmo raggrupparli, ma per le pizze è più comodo slegarli
    
    // Per comodità: raggruppiamo solo se non ci sono "modifiers" attivi?
    // L'approccio migliore per un POS pizzeria rapido: raggruppa se è identico, se modificato si separa.
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && (!item.modifiers || item.modifiers.length === 0));
      if (existing) {
        return prev.map(item => item.cartId === existing.cartId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, cartId: Date.now() + Math.random(), quantity: 1, modifiers: [], originalPrice: product.price }];
    });
  };

  const updateQuantity = (cartId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeItem = (cartId) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
    if (editingItem?.cartId === cartId) setEditingItem(null);
  };

  const openEditor = (item) => {
    // Apri modale per modificare
    setEditingItem(item);
  };

  const toggleModifier = (modifier) => {
    if (!editingItem) return;

    setCart(prev => prev.map(item => {
      if (item.cartId === editingItem.cartId) {
        let newMods = item.modifiers ? [...item.modifiers] : [];
        let newPrice = item.price;
        
        const isSelected = newMods.find(m => m.value === modifier.value);
        if (isSelected) {
          // Rimuovi modificatore
          newMods = newMods.filter(m => m.value !== modifier.value);
          newPrice -= modifier.price;
        } else {
          // Aggiungi modificatore
          newMods.push(modifier);
          newPrice += modifier.price;
        }

        const updatedItem = { ...item, modifiers: newMods, price: Math.max(0, newPrice) };
        setEditingItem(updatedItem); // aggiorna modale
        return updatedItem;
      }
      return item;
    }));
  };

  // --- Funzioni API ---
  const handlePrintTicket = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    
    // Formattiamo le note e item per includere i modifiers a livello server
    const payloadItems = cart.map(item => ({
      ...item,
      name: item.name + (item.modifiers && item.modifiers.length > 0 
        ? ' (' + item.modifiers.map(m => m.value).join(', ') + ')' 
        : '')
    }));

    try {
      const res = await fetch(`${API_BASE}/print-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: Date.now().toString().slice(-6),
          table: 'Asporto',
          orderItems: payloadItems
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

    const payloadItems = cart.map(item => ({
      ...item,
      name: item.name + (item.modifiers && item.modifiers.length > 0 
        ? ' (' + item.modifiers.map(m => m.value).join(', ') + ')' 
        : '')
    }));

    try {
      const res = await fetch(`${API_BASE}/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: Date.now().toString().slice(-6),
          total: cartTotal,
          paymentType,
          orderItems: payloadItems
        }),
      });
      if (!res.ok) throw new Error('Errore server');
      showNotification('Scontrino Fiscale emesso!');
      setCart([]);
      setEditingItem(null);
    } catch (err) {
      showNotification('Errore K3 Custom', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    if(!window.confirm('Procedere con chiusura Z ?')) return;
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

  return (
    <div className="pos-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* MODALE MODIFICA INGREDIENTI */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Modifica: {editingItem.name}</h2>
              <button className="btn-close-modal" onClick={() => setEditingItem(null)}>Chiudi</button>
            </div>
            <div className="modifiers-grid">
              {INGREDIENT_MODIFIERS.map((mod, i) => {
                const isActive = editingItem.modifiers?.find(m => m.value === mod.value);
                return (
                  <button 
                    key={i} 
                    className={`modifier-btn ${isActive ? 'active' : ''}`}
                    onClick={() => toggleModifier(mod)}
                  >
                    {mod.label}
                  </button>
                )
              })}
            </div>
          </div>
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
            <div className="cart-empty">Nessun prodotto...</div>
          ) : (
            cart.map(item => (
              <div key={item.cartId} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  {/* Etichette dei modificatori inseriti */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="cart-item-modifiers">
                      {item.modifiers.map(m => m.value).join(', ')}
                    </div>
                  )}
                  <div className="cart-item-price">€ {(item.price * item.quantity).toFixed(2)}</div>
                  <div className="cart-item-actions">
                    <button className="btn-text" onClick={() => openEditor(item)}>✏️ Modifica</button>
                    <button className="btn-text danger" onClick={() => removeItem(item.cartId)}>🗑️ Rimuovi</button>
                  </div>
                </div>
                
                <div className="cart-item-controls">
                  <button className="qty-btn" onClick={() => item.quantity > 1 ? updateQuantity(item.cartId, -1) : removeItem(item.cartId)}>-</button>
                  <span className="qty-text">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.cartId, 1)}>+</button>
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
              🖨️ Stampa Cucina (Epson)
            </button>
            <button className="btn-primary" onClick={handlePrintReceipt} disabled={cart.length === 0 || loading}>
              🧾 Scontrino Fiscale (Custom K3)
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
