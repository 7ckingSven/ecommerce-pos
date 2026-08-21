import React, { createContext, useContext, useState, useCallback } from 'react';
import { getCart } from '../services/cartService';
import { isLoggedIn } from '../services/authService';

const CartContext = createContext({ cartCount: 0, refreshCartCount: () => {} });

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    try {
      const logged = await isLoggedIn();
      if (!logged) { setCartCount(0); return; }
      const data = await getCart();
      setCartCount(data?.length || 0);
    } catch (e) {
      console.error('Cart count error:', e);
    }
  }, []);

  return (
    <CartContext.Provider value={{ cartCount, setCartCount, refreshCartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}