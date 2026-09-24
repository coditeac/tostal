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
        compact ? "px-0" : "px-5 pt-5"
      }`}
    >
      <Link href="/" className="min-w-0">
        {!compact && (
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tostal-logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-md object-cover"
            />
            <div>
              <p className="font-brand text-xl leading-none text-miel">
                Tostal
              </p>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-muted">
                Sabores que unen culturas
              </p>
            </div>
          </div>
        )}
        {compact && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Menú del día
          </p>
        )}
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/seguimiento"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-cacao"
          aria-label="Seguir pedido"
        >
          <Search size={18} />
        </Link>
        <Link
          href="/carrito"
          className="relative inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-cacao"
          aria-label="Carrito"
        >
          <ShoppingBag size={18} />
          {cart.totalItems > 0 ? (
            <span>{formatoMoneda(cart.subtotal)}</span>
          ) : (
            <span className="text-muted">0</span>
          )}
          {cart.totalItems > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-miel px-1 text-[11px] font-bold text-[#d6d2c4]">
              {cart.totalItems}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
