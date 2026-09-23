"use client";

import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { formatoMoneda } from "@/lib/api";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const cart = useCart();

  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        compact ? "px-0" : "px-4 pt-4"
      }`}
    >
      <Link href="/" className="min-w-0">
        <p className="font-display text-2xl leading-none text-cacao">Tostal</p>
        {!compact && (
          <p className="truncate text-xs text-muted">Sabores que unen culturas</p>
        )}
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/seguimiento"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-cacao"
          aria-label="Seguir pedido"
        >
          <Search size={18} />
        </Link>
        <Link
          href="/carrito"
          className="relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-cacao"
          aria-label="Carrito"
        >
          <ShoppingBag size={18} />
          {cart.totalItems > 0 ? (
            <span>{formatoMoneda(cart.subtotal)}</span>
          ) : (
            <span className="text-muted">0</span>
          )}
          {cart.totalItems > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-miel px-1 text-[11px] font-bold text-white">
              {cart.totalItems}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
