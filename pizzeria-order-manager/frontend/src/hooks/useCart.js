import { useState, useRef, useEffect } from 'react';
import { INGREDIENT_MODIFIERS, SPECIAL_MODIFIERS } from '../data';

export const useCart = (orderType, deliveryFeeQuantity) => {
  const [cart, setCart] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalContext, setCustomModalContext] = useState('ORDER');
  const [customModalForm, setCustomModalForm] = useState({ name: '', price: 0 });
  const [familyHalfIndex, setFamilyHalfIndex] = useState(null);
  const [selectingHalfFor, setSelectingHalfFor] = useState(null);
  const cartEndRef = useRef(null);

  useEffect(() => {
    if (cartEndRef.current) {
      cartEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cart]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + (orderType === 'DOMICILIO' ? 2 * deliveryFeeQuantity : 0);

  const calculateItemPrice = (item, tempDelta, tempMods) => {
    if (item.isFamily) {
      let baseFamiliesPrice = 0;
      let allHalvesEmpty = !item.halves || (!item.halves[0] && !item.halves[1]);
      
      if (!allHalvesEmpty) {
         let isAllMargherita = true;
         if (item.halves[0] && item.halves[0].name.toLowerCase() !== 'margherita') isAllMargherita = false;
         if (item.halves[1] && item.halves[1].name.toLowerCase() !== 'margherita') isAllMargherita = false;
         baseFamiliesPrice = isAllMargherita ? 18.0 : 24.0;
      }
      
      let subtotal = baseFamiliesPrice;
      if (item.halves) {
        item.halves.forEach(half => {
          if (half) {
             const mods = half.modifiers || [];
             subtotal += mods.reduce((sum, m) => sum + m.price, 0);
          }
        });
      }
      let delta = tempDelta !== undefined ? tempDelta : (item.manualPriceDelta || 0);
      return { price: subtotal + delta, manualPriceDelta: delta };
    }

    let basePrice = item.originalPrice;
    const mods = tempMods || item.modifiers || [];
    const hasBaby = mods.find(m => m.value === 'Baby');
    if (hasBaby) {
      const n = item.name.toLowerCase();
      if (n.includes('margherita') || n.includes('focaccia')) {
        basePrice = 5.0;
      } else {
        basePrice = 7.0;
      }
    }
    
    let subtotal = basePrice;
    mods.forEach(m => {
      subtotal += m.price;
    });

    let delta = tempDelta !== undefined ? tempDelta : (item.manualPriceDelta || 0);
    
    return {
      price: subtotal + delta,
      manualPriceDelta: delta
    };
  };

  const addToCart = (product) => {
    if (product.category !== 'pizze') {
      setCart(prev => {
        const existingIndex = prev.findIndex(item => item.id === product.id && item.category !== 'pizze');
        if (existingIndex >= 0) {
          const newCart = [...prev];
          newCart[existingIndex] = { 
            ...newCart[existingIndex], 
            quantity: newCart[existingIndex].quantity + 1 
          };
          return newCart;
        }
        return [...prev, { ...product, cartId: Date.now() + Math.random(), quantity: 1, modifiers: [], originalPrice: product.price }];
      });
    } else {
      if (selectingHalfFor !== null) {
        setCart(prev => prev.map(cItem => {
          if (cItem.cartId === selectingHalfFor.cartId) {
             const newHalves = [...cItem.halves];
             newHalves[selectingHalfFor.halfIndex] = {
                ...product,
                modifiers: [],
                originalPrice: product.price
             };
             const tempItem = { ...cItem, halves: newHalves };
             const { price, manualPriceDelta } = calculateItemPrice(tempItem, tempItem.manualPriceDelta);
             return { ...tempItem, price, manualPriceDelta };
          }
          return cItem;
        }));
        
        if (selectingHalfFor.halfIndex === 0) {
           setSelectingHalfFor({ cartId: selectingHalfFor.cartId, halfIndex: 1 });
        } else {
           setSelectingHalfFor(null);
        }
        return;
      }

      setCart(prev => {
        const newItem = {
          ...product,
          cartId: `cart_${Date.now()}_${Math.random()}`,
          quantity: 1,
          modifiers: [],
          originalPrice: product.price,
          manualPriceDelta: 0,
        };
        return [...prev, newItem];
      });
    }
  };

  const formatModifiers = (modifiers, manualDelta = 0) => {
    const parts = [];
    const customNotes = [];
    if (modifiers && modifiers.length > 0) {
      const preVals = [...INGREDIENT_MODIFIERS.map(m => m.value), ...SPECIAL_MODIFIERS.map(m => m.value)];
      modifiers.forEach(m => {
        let val = m.value.trim();
        if (val.startsWith('- ')) val = 'NO ' + val.substring(2);
        const isCustomNote = !preVals.includes(m.value) && !m.value.startsWith('- ') && m.price === 0;
        const str = (m.price === 0) ? val : `${val} (${m.price > 0 ? '+' : ''}${m.price.toFixed(2)}€)`;
        if (isCustomNote) customNotes.push(str);
        else parts.push(str);
      });
    }
    if (manualDelta > 0) parts.push(`Sovrapprezzo (+${manualDelta.toFixed(2)}€)`);
    else if (manualDelta < 0) parts.push(`Sconto (${manualDelta.toFixed(2)}€)`);
    parts.push(...customNotes);
    return parts.join(', ');
  };

  const handleAddFamilyPizza = () => {
    const newItem = {
      cartId: `family_${Date.now()}`,
      id: 'family_pizza',
      name: 'Pizza Famiglia',
      price: 0, 
      originalPrice: 0,
      quantity: 1,
      category: 'pizze',
      isFamily: true,
      halves: [null, null],
      manualPriceDelta: 0,
    };
    setCart(prev => [...prev, newItem]);
    
    setSelectingHalfFor({ cartId: newItem.cartId, halfIndex: 0 });
    setTimeout(() => { if (cartEndRef.current) cartEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, 100);
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
    if (item.category !== 'pizze') return;
    setEditingItem(item);
  };

  const toggleModifier = (modifier) => {
    if (!editingItem) return;

    setCart(prev => prev.map(item => {
      if (item.cartId === editingItem.cartId) {
        if (item.isFamily && familyHalfIndex !== null) {
           const half = item.halves[familyHalfIndex];
           if (!half) return item;
           let newMods = half.modifiers ? [...half.modifiers] : [];
           const isSelected = newMods.find(m => m.value === modifier.value);
           if (isSelected) {
             newMods = newMods.filter(m => m.value !== modifier.value);
           } else {
             newMods.push(modifier);
           }
           const updatedHalves = [...item.halves];
           updatedHalves[familyHalfIndex] = { ...half, modifiers: newMods };
           const updatedItemForPrice = { ...item, halves: updatedHalves };
           const { price, manualPriceDelta } = calculateItemPrice(updatedItemForPrice, item.manualPriceDelta);
           const finalItem = { ...updatedItemForPrice, price, manualPriceDelta };
           setEditingItem(finalItem);
           return finalItem;
        }

        let newMods = item.modifiers ? [...item.modifiers] : [];
        
        const isSelected = newMods.find(m => m.value === modifier.value);
        if (isSelected) {
          newMods = newMods.filter(m => m.value !== modifier.value);
        } else {
          newMods.push(modifier);
        }

        const { price, manualPriceDelta } = calculateItemPrice(item, item.manualPriceDelta, newMods);
        const updatedItem = { ...item, modifiers: newMods, price, manualPriceDelta };
        setEditingItem(updatedItem);
        return updatedItem;
      }
      return item;
    }));
  };

  const handleAddCustom = () => {
    let finalName = customModalForm.name.trim();
    if (!finalName) {
      if (customModalForm.price > 0) finalName = 'Sovrapprezzo';
      else if (customModalForm.price < 0) finalName = 'Sconto';
      else return;
    }
    
    if (customModalContext === 'ORDER') {
      const newItem = {
        id: `custom_${Date.now()}`,
        name: finalName,
        price: customModalForm.price,
        category: 'altro',
        modifiers: [],
        manualPriceDelta: 0,
        cartId: `custom_${Date.now()}`,
        quantity: 1,
        basePrice: customModalForm.price
      };
      setCart(prev => [...prev, newItem]);
      setTimeout(() => { if (cartEndRef.current) cartEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, 100);
    } else if (customModalContext === 'ITEM' && editingItem) {
      setCart(prev => prev.map(item => {
        if (item.cartId === editingItem.cartId) {
          const newMod = { label: finalName, value: finalName, price: customModalForm.price };
          
          if (item.isFamily && familyHalfIndex !== null) {
             const half = item.halves[familyHalfIndex];
             if (!half) return item;
             let newMods = half.modifiers ? [...half.modifiers] : [];
             newMods.push(newMod);
             const updatedHalves = [...item.halves];
             updatedHalves[familyHalfIndex] = { ...half, modifiers: newMods };
             const updatedItemForPrice = { ...item, halves: updatedHalves };
             const { price, manualPriceDelta } = calculateItemPrice(updatedItemForPrice, item.manualPriceDelta);
             const finalItem = { ...updatedItemForPrice, price, manualPriceDelta };
             setEditingItem(finalItem);
             return finalItem;
          }

          let newMods = item.modifiers ? [...item.modifiers] : [];
          newMods.push(newMod);
          
          const { price, manualPriceDelta } = calculateItemPrice(item, item.manualPriceDelta, newMods);
          const updatedItem = { ...item, modifiers: newMods, price, manualPriceDelta };
          setEditingItem(updatedItem); 
          return updatedItem;
        }
        return item;
      }));
    }
    
    setCustomModalForm({ name: '', price: 0 });
    setCustomModalOpen(false);
  };

  return {
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
  };
};
