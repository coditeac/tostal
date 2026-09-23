"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  notas?: string;
};

type CartState = {
  fecha: string | null;
  items: CartItem[];
  setFecha: (fecha: string) => void;
  addItem: (item: Omit<CartItem, "cantidad">, qty?: number) => void;
  setQty: (productoId: string, cantidad: number) => void;
  clear: () => void;
  totalItems: number;
  subtotal: number;
};

const CartContext = createContext<CartState | null>(null);
const KEY = "tostal-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [fecha, setFechaState] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { fecha: string | null; items: CartItem[] };
        setFechaState(parsed.fecha);
        setItems(parsed.items || []);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify({ fecha, items }));
  }, [fecha, items, ready]);

  const value = useMemo<CartState>(() => {
    return {
      fecha,
      items,
      setFecha: (f) => {
        setFechaState((prev) => {
          if (prev && prev !== f) setItems([]);
          return f;
        });
      },
      addItem: (item, qty = 1) => {
        setItems((list) => {
          const existing = list.find((x) => x.productoId === item.productoId);
          if (existing) {
            return list.map((x) =>
              x.productoId === item.productoId
                ? { ...x, cantidad: x.cantidad + qty }
                : x
            );
          }
          return [...list, { ...item, cantidad: qty }];
        });
      },
      setQty: (productoId, cantidad) => {
        setItems((list) =>
          cantidad <= 0
            ? list.filter((x) => x.productoId !== productoId)
            : list.map((x) =>
                x.productoId === productoId ? { ...x, cantidad } : x
              )
        );
      },
      clear: () => setItems([]),
      totalItems: items.reduce((a, i) => a + i.cantidad, 0),
      subtotal: items.reduce((a, i) => a + i.precio * i.cantidad, 0),
    };
  }, [fecha, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart fuera de CartProvider");
  return ctx;
}
