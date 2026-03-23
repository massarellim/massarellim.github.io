import { useState, useCallback } from 'react';
import { API_BASE } from '../data';

export const useCustomers = (showNotification, setIsOrderConfigured, setLoading) => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ id: null, name: '', phone: '', address: '', notes: '' });
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [customerSortBy, setCustomerSortBy] = useState('name');
  const [customerSortDirection, setCustomerSortDirection] = useState('asc');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isCustomerSearchFocused, setIsCustomerSearchFocused] = useState(false);
  const [customerFilter, setCustomerFilter] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/customers`);
      if (res.ok) setCustomers(await res.json());
    } catch(err) { console.error('Err fetch customers', err); }
  }, []);

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.name.trim()) {
      showNotification('Inserisci il nome o un riferimento per il cliente.', 'error');
      return;
    }
    setLoading(true);
    try {
      const method = customerForm.id ? 'PUT' : 'POST';
      const url = customerForm.id ? `${API_BASE}/customers/${customerForm.id}` : `${API_BASE}/customers`;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerForm) });
      if (res.ok) {
        let savedCustomer = { ...customerForm };
        try {
          const data = await res.json();
          if (data && data.id) savedCustomer.id = data.id;
        } catch (err) {}
        
        showNotification('Cliente salvato!');
        setCustomerModalOpen(false);
        fetchCustomers();
        
        // Auto-selezione intelligente
        setSelectedCustomer(savedCustomer);
        setIsOrderConfigured(true);
      }
    } catch(err) {
      showNotification('Errore salvataggio cliente', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async () => {
    if(!customerToDelete) return;
    try {
      const res = await fetch(`${API_BASE}/customers/${customerToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Impossibile eliminare il cliente', 'error');
      } else {
        fetchCustomers();
        showNotification('Cliente eliminato');
        if (selectedCustomer && selectedCustomer.id === customerToDelete.id) setSelectedCustomer(null);
      }
    } catch(err) {
      showNotification('Errore di connessione', 'error');
    }
    setCustomerToDelete(null);
  };

  return {
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
  };
};
