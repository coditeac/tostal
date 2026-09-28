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
        compact ? "px-0" : "px-6 pt-5"
      }`}
    >
      <Link href="/" className="min-w-0">
        {!compact && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/tostal-logo-marca.png"
            alt="Tostal"
            width={160}
            height={68}
            className="h-9 w-auto object-contain"
          />
        )}
        {compact && (
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            Menú de hoy
          </p>
        )}
      </Link>
      <div className="flex items-center gap-1.5">
        <Link
          href="/reservas"
          className="inline-flex h-10 items-center rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Reservas
        </Link>
        <Link
          href="/cuenta"
          className="inline-flex h-10 items-center rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Cuenta
        </Link>
        <Link
          href="/seguimiento"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary"
          aria-label="Seguir pedido"
        >
          <Search size={18} strokeWidth={1.75} />
        </Link>
        <Link
          href="/carrito"
          className="relative inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          aria-label="Carrito"
        >
          <ShoppingBag size={18} strokeWidth={1.75} />
          {cart.totalItems > 0 ? (
            <span className="tabular-nums">{formatoMoneda(cart.subtotal)}</span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
          {cart.totalItems > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-miel px-1 text-[10px] font-semibold text-[#d6d2c4]">
              {cart.totalItems}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
