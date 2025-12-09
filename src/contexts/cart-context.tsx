'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Product } from '@/lib/models/definitions';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface PhaseRewardDiscount {
  type: 'free_product' | 'store_credit';
  amountCents: number;
  phase: number;
}

export interface PhaseGroupGain {
  userPhase: number;
  gainRate: number;
  gainPercentage: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getProductDiscount: () => number;
  getRewardDiscount: () => number;
  getDiscount: () => number;
  getTotal: () => number;
  phaseReward: PhaseRewardDiscount | null;
  setPhaseReward: (reward: PhaseRewardDiscount | null) => void;
  phaseGroupGain: PhaseGroupGain | null;
  setPhaseGroupGain: (gain: PhaseGroupGain | null) => void;
}

// Default context value for SSR safety
const defaultContextValue: CartContextType = {
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  getSubtotal: () => 0,
  getProductDiscount: () => 0,
  getRewardDiscount: () => 0,
  getDiscount: () => 0,
  getTotal: () => 0,
  phaseReward: null,
  setPhaseReward: () => {},
  phaseGroupGain: null,
  setPhaseGroupGain: () => {},
};

const CartContext = createContext<CartContextType>(defaultContextValue);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [phaseReward, setPhaseReward] = useState<PhaseRewardDiscount | null>(null);
  const [phaseGroupGain, setPhaseGroupGain] = useState<PhaseGroupGain | null>(null);

  // Load cart from sessionStorage on mount (more secure than localStorage)
  useEffect(() => {
    const savedCart = sessionStorage.getItem('cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart from sessionStorage:', error);
      }
    }
  }, []);

  // Save cart to sessionStorage whenever items change (cleared on tab close)
  useEffect(() => {
    sessionStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product: Product) => {
    setItems(currentItems => {
      const existingItem = currentItems.find(item => item.product.id === product.id);
      if (existingItem) {
        return currentItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...currentItems, { product, quantity: 1 }];
      }
    });
  };

  const removeItem = (productId: string) => {
    setItems(currentItems => currentItems.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems(currentItems =>
      currentItems.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getSubtotal = () => {
    return items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  };

  const getProductDiscount = () => {
    return items.reduce((total, item) => {
      const { discountAmount } = getDiscountedUnitPrice(item.product);
      return total + discountAmount * item.quantity;
    }, 0);
  };

  const getRewardDiscount = () => {
    if (!phaseReward) {
      return 0;
    }

    const subtotal = getSubtotal();
    const productDiscount = getProductDiscount();
    const remainingSubtotal = Math.max(0, subtotal - productDiscount);
    if (remainingSubtotal <= 0) {
      return 0;
    }

    const rewardDollars = phaseReward.amountCents / 100;
    return Math.min(rewardDollars, remainingSubtotal);
  };

  const getDiscount = () => {
    return getProductDiscount() + getRewardDiscount();
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const totalDiscount = getDiscount();
    return Math.max(0, subtotal - totalDiscount);
  };

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getSubtotal,
      getProductDiscount,
      getRewardDiscount,
      getDiscount,
      getTotal,
      phaseReward,
      setPhaseReward,
      phaseGroupGain,
      setPhaseGroupGain,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  return context;
}