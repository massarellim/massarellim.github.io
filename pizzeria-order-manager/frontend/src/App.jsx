import React, { useState, useEffect } from 'react';
import './App.css';

const MENU_ITEMS = [
  // Pizze Classiche
  { id: 100, name: 'Margherita', price: 5.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella'] },
  { id: 101, name: 'Marinara', price: 4.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Aglio', 'Olio', 'Origano'] },
  { id: 102, name: 'Pomodoro', price: 4.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Olio', 'Origano'] },
  { id: 103, name: 'Napoli', price: 6.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Acciughe', 'Origano'] },
  { id: 104, name: 'Romana', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Acciughe', 'Capperi', 'Origano'] },
  { id: 105, name: 'Siciliana', price: 6.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Acciughe', 'Capperi', 'Olive', 'Origano'] },
  { id: 106, name: 'Pugliese', price: 6.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Cipolla'] },
  { id: 107, name: 'Olive', price: 5.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Olive'] },
  { id: 108, name: 'Funghi', price: 6.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Funghi'] },
  { id: 109, name: 'Porcini', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Porcini'] },
  { id: 110, name: 'Pomodorini', price: 5.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Pomodorini'] },
  { id: 111, name: 'Verd. Grigliate', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Verdure Grigliate'] },
  { id: 112, name: 'Parmigiana', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Prosciutto Cotto', 'Melanzane', 'Grana'] },
  { id: 1122, name: 'Wurstel', price: 6.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Wurstel'] },
  
  // Salumi e Carni
  { id: 113, name: 'Prosciutto', price: 6.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Prosciutto Cotto'] },
  { id: 114, name: 'Prosc. e Funghi', price: 7.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Prosciutto Cotto', 'Funghi'] },
  { id: 115, name: 'Prosc. e Carciofi', price: 7.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Prosciutto Cotto', 'Carciofi'] },
  { id: 116, name: 'Salamino Piccante', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salamino Piccante'] },
  { id: 117, name: 'Salsiccia', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salsiccia'] },
  { id: 119, name: 'Speck', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Speck'] },
  { id: 120, name: 'Crudo', price: 7.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma'] },
  { id: 121, name: 'Bresaola', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Bresaola'] },
  
  // Affettati Speciali
  { id: 122, name: 'Crudo e Grana', price: 8.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Grana'] },
  { id: 123, name: 'Crudo e Rucola', price: 8.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Rucola'] },
  { id: 124, name: 'Crudo, gr. e ruc.', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Grana', 'Rucola'] },
  { id: 125, name: 'Bresaola e Brie', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Bresaola', 'Brie'] },
  { id: 126, name: 'Bresaola e Grana', price: 9.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Bresaola', 'Grana'] },
  { id: 1266, name: 'Bresa., gr., ruc', price: 9.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Bresaola', 'Grana', 'Rucola'] },
  { id: 127, name: 'Speck e Brie', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Speck', 'Brie'] },
  { id: 128, name: 'Grana e Rucola', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Grana', 'Rucola'] },
  { id: 1281, name: 'Crudo e Panna', price: 9.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Panna'] },
  { id: 1282, name: 'Crudo e Porcini', price: 9.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Porcini'] },
  { id: 1283, name: 'Speck e Panna', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Speck', 'Panna'] },
  { id: 1284, name: 'Speck e Porcini', price: 9.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Speck', 'Porcini'] },
  { id: 1285, name: 'Speck, porc, ruc', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Speck', 'Porcini', 'Rucola'] },
  
  // Formaggi
  { id: 129, name: 'Zola', price: 6.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Zola'] },
  { id: 130, name: 'Zola e Noci', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Zola', 'Noci'] },
  { id: 131, name: 'Caprese', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Mozzarella di Bufala', 'Pomodorini', 'Basilico'] },
  
  // Pesce
  { id: 132, name: 'Tonno', price: 7.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Tonno'] },
  { id: 133, name: 'Tonno e Cipolle', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Tonno', 'Cipolla'] },
  { id: 134, name: 'Frutti di mare', price: 9.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Frutti di Mare'] },
  { id: 135, name: 'Gamberetti', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Gamberetti'] },
  { id: 1355, name: 'Gamberetti e Panna', price: 9.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Gamberetti', 'Panna'] },
  { id: 1356, name: 'Gamber. e Zucchine', price: 9.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Gamberetti', 'Zucchine'] },
  { id: 136, name: 'Mari e Monti', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Frutti di Mare', 'Porcini'] },

  // Speciali / Gourmet
  { id: 137, name: 'Affumicata', price: 9.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Provola Affumicata', 'Speck'] },
  { id: 138, name: 'Boscaiola', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Porcini', 'Grana'] },
  { id: 139, name: 'Carpaccio', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Bresaola', 'Rucola', 'Grana'] },
  { id: 140, name: 'Gustosa', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salsiccia', 'Patatine Fritte'] },
  { id: 141, name: 'Enjoy', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Zucchine', 'Salmone', 'Panna'] },
  { id: 142, name: 'Tricolore', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Mozzarella di Bufala', 'Pomodorini', 'Basilico'] },
  { id: 143, name: 'Saporita', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salsiccia', 'Cipolla', 'Zola'] },
  { id: 144, name: 'Tedesca', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Prosciutto Cotto', 'Salamino', 'Wurstel'] },
  { id: 145, name: 'Briscola', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Pancetta', 'Melanzane', 'Zola', 'Grana'] },
  { id: 146, name: 'Zucchinella', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo di Parma', 'Zucchine', 'Provola'] },
  { id: 147, name: 'Adige', price: 8.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Speck', 'Zola'] },
  { id: 148, name: 'Contadina', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salsiccia', 'Asiago'] },
  { id: 149, name: 'Giudea', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Carciofi', 'Acciughe', 'Grana'] },
  { id: 150, name: 'Pizza Pazza', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Provola Aff.', 'Salame Nostrano'] },
  { id: 151, name: 'Top', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Pancetta', 'Trevisana', 'Zola'] },
  { id: 152, name: 'Blitz', price: 8.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salsiccia', 'Trevisana', 'Provola'] },
  { id: 153, name: 'Crazy', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salsiccia', 'Trevisana', 'Zola', 'Grana'] },
  { id: 154, name: 'Appetitosa', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Pancetta', 'Provola', 'Pomodorini'] },
  { id: 155, name: 'Pancetta Paradise', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Pancetta', 'Cipolla'] },
  { id: 156, name: 'Montana', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Pancetta', 'Porcini', 'Grana'] },
  { id: 157, name: 'Veneta', price: 8.50, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Salamino', 'Peperoni Grigliati'] },
  { id: 158, name: 'Italia', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Prosciutto Cotto', 'Salamino', 'Bufala'] },
  { id: 159, name: 'Svizzera', price: 8.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Tonno', 'Wurstel', 'Olive'] },
  { id: 160, name: 'Profumata', price: 10.00, category: 'pizze', icon: '🍕', ingredients: ['Pomodoro', 'Mozzarella', 'Crudo', 'Pomodorini', 'Rucola'] },

  // Bevande e Dolci (Mantenuti dal mock per testabilità)
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
  { id: 'clienti', label: '👥 Clienti' },
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

  // Cottura
  { label: 'Ben Cotta', value: 'Ben cotta', price: 0 },
];

const getRemovalDiscount = (ingrName) => {
  const n = ingrName.toLowerCase();
  if (n.includes('aglio') || n.includes('olio') || n.includes('origano') || n.includes('basilico') || n.includes('prezzemolo') || n.includes('sale')) return 0;
  if (n.includes('crudo') || n.includes('speck') || n.includes('bresaola') || n.includes('noci') || n.includes('porcini') || n.includes('bufala') || n.includes('frutti di mare') || n.includes('gamberetti') || n.includes('salmone')) return 2.0;
  if (n.includes('grana') || n.includes('tonno') || n.includes('salame') || n.includes('verdure') || n.includes('pancetta') || n.includes('pomodorini') || n.includes('trevisana') || n.includes('provola') || n.includes('salsiccia') || n.includes('asiago')) return 1.5;
  if (n.includes('pomodoro') || n.includes('mozzarella') || n.includes('capperi') || n.includes('panna') || n.includes('rucola') || n.includes('cipolla')) return 0.5;
  return 1.0;
};

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [activeTab, setActiveTab] = useState('tutte');
  const [cart, setCart] = useState([]);
  const [paymentType, setPaymentType] = useState('CASH');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ id: null, name: '', phone: '', address: '', notes: '' });

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers`);
      if (res.ok) setCustomers(await res.json());
    } catch(err) { console.error('Err fetch customers', err); }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const method = customerForm.id ? 'PUT' : 'POST';
      const url = customerForm.id ? `${API_BASE}/customers/${customerForm.id}` : `${API_BASE}/customers`;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerForm) });
      if (res.ok) {
        showNotification('Cliente salvato!');
        setCustomerModalOpen(false);
        fetchCustomers();
      }
    } catch(err) {
      showNotification('Errore salvataggio cliente', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id) => {
    if(!window.confirm('Eliminare questo cliente?')) return;
    try {
      await fetch(`${API_BASE}/customers/${id}`, { method: 'DELETE' });
      fetchCustomers();
      showNotification('Cliente eliminato');
      if (selectedCustomer && selectedCustomer.id === id) setSelectedCustomer(null);
    } catch(err) {}
  };

  const displayedItems = activeTab === 'tutte' 
    ? MENU_ITEMS 
    : MENU_ITEMS.filter(item => item.category === activeTab);

  // Calcola totale dinamico tenendo conto dei modificatori
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotification('Riconoscimento vocale non supportato nel tuo browser.', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      
      let addedAtLeastOne = false;
      const sortedMenu = [...MENU_ITEMS].sort((a,b) => b.name.length - a.name.length);
      
      sortedMenu.forEach(item => {
         const nameLC = item.name.toLowerCase();
         const root = nameLC.length > 4 ? nameLC.slice(0, -1) : nameLC;
         
         if (transcript.includes(root)) {
            addToCart(item);
            addedAtLeastOne = true;
         }
      });

      if (addedAtLeastOne) {
         showNotification(`🎤 Capito: "${transcript}"`, 'success');
      } else {
         showNotification(`❓ Non ho capito da: "${transcript}"`, 'error');
      }
    };

    recognition.onerror = (event) => {
      showNotification('Errore microfono: ' + event.error, 'error');
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
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
          orderItems: payloadItems,
          customer: selectedCustomer
        }),
      });
      if (!res.ok) throw new Error('Errore server');
      showNotification('Scontrino Fiscale emesso!');
      setCart([]);
      setEditingItem(null);
      setSelectedCustomer(null);
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
            <div className="modal-body-scroll">
              {editingItem.ingredients && editingItem.ingredients.length > 0 && (
                <>
                  <h3 className="modal-section-title">Ingredienti base (clicca per rimuovere)</h3>
                  <div className="modifiers-grid remove-grid">
                    {editingItem.ingredients.map((ingr, i) => {
                      const discount = getRemovalDiscount(ingr);
                      const modValue = `- ${ingr}`;
                      const isActive = editingItem.modifiers?.find(m => m.value === modValue);
                      const discountText = discount > 0 ? ` (-€${discount.toFixed(2)})` : '';
                      return (
                        <button 
                          key={`rem-${i}`} 
                          className={`modifier-btn danger-btn ${isActive ? 'active-remove' : ''}`}
                          onClick={() => toggleModifier({ label: `Senza ${ingr}`, value: modValue, price: -discount })}
                        >
                          {isActive ? `✓ Rimosso: ${ingr}${discountText}` : `✗ Togli ${ingr}${discountText}`}
                        </button>
                      )
                    })}
                  </div>
                  <hr className="modal-divider" />
                </>
              )}

              <h3 className="modal-section-title">Aggiungi Extra</h3>
              <div className="modifiers-grid">
                {INGREDIENT_MODIFIERS.map((mod, i) => {
                  const isActive = editingItem.modifiers?.find(m => m.value === mod.value);
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
            </div>
          </div>
        </div>
      )}

      {/* MODALE CLIENTI */}
      {customerModalOpen && (
        <div className="modal-overlay" onClick={() => setCustomerModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{customerForm.id ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
              <button className="btn-close-modal" onClick={() => setCustomerModalOpen(false)}>Chiudi</button>
            </div>
            <form onSubmit={handleSaveCustomer} className="customer-form" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <input required type="text" placeholder="Nome o Riferimento" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} className="form-input" />
              <input type="text" placeholder="Telefono (es. 333...)" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="form-input" />
              <input type="text" placeholder="Indirizzo (es. Via Roma 1)" value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value})} className="form-input" />
              <input type="text" placeholder="Note (es. Intollerante Panna)" value={customerForm.notes} onChange={e => setCustomerForm({...customerForm, notes: e.target.value})} className="form-input" />
              <button type="submit" className="btn-primary" style={{marginTop: '15px'}} disabled={loading}>Salva Cliente</button>
            </form>
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

        {activeTab === 'clienti' ? (
          <div className="customers-view">
            <div className="customers-header" style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
              <h2>Gestione Clienti</h2>
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => { setCustomerForm({ id: null, name: '', phone: '', address: '', notes: '' }); setCustomerModalOpen(true); }}>
                + Nuovo Cliente
              </button>
            </div>
            <div className="customers-grid">
              {customers.map(c => (
                <div key={c.id} className="customer-card">
                  <div className="customer-info" onClick={() => { setSelectedCustomer(c); showNotification(`Cliente ${c.name} assegnato all'ordine.`); }} style={{cursor: 'pointer'}} title="Clicca per assegnare come ordine corrente">
                    <h3>{c.name}</h3>
                    {c.phone && <p>📞 {c.phone}</p>}
                    {c.address && <p>🏠 {c.address}</p>}
                    {c.notes && <p className="customer-notes">{c.notes}</p>}
                  </div>
                  <div className="customer-actions">
                    <button className="btn-text" onClick={() => { setCustomerForm(c); setCustomerModalOpen(true); }}>✏️ Modifica</button>
                    <button className="btn-text danger" onClick={() => deleteCustomer(c.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
            {customers.length === 0 && <p className="cart-empty">Nessun cliente registrato.</p>}
          </div>
        ) : (
          <div className="menu-grid">
            {displayedItems.map(item => (
              <div key={item.id} className="menu-item" onClick={() => addToCart(item)}>
                <div className="item-name">{item.name}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEZIONE DESTRA - CARRELLO/CASSA */}
      <section className="cart-section">
        <div className="cart-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>Nuovo Ordine</h2>
            <button 
              className={`btn-mic ${isListening ? 'listening' : ''}`} 
              onClick={startListening}
              title="Dì ad esempio: 'Una margherita e una diavola'"
            >
              {isListening ? '🛑' : '🎤'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedCustomer && (
              <div className="customer-pill">
                👤 {selectedCustomer.name}
                <span onClick={() => setSelectedCustomer(null)} className="pill-close">×</span>
              </div>
            )}
            {cart.length > 0 && (
               <button className="btn-clear" onClick={() => setCart([])}>Svuota</button>
            )}
          </div>
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
