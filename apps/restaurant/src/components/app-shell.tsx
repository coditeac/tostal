"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  ShoppingCart,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

const links = [
  { href: "/panel", label: "Inicio", icon: LayoutDashboard },
  { href: "/produccion", label: "Cocina", icon: UtensilsCrossed },
  { href: "/inventario", label: "Stock", icon: Package },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/gastos", label: "Gastos", icon: Wallet },
  { href: "/caja", label: "Caja", icon: Store },
  { href: "/avisos", label: "Avisos", icon: MessageCircle },
];

const moreLinks = [
  { href: "/costos", label: "Costos" },
  { href: "/panel/pedidos", label: "Pedidos" },
  { href: "/panel/productos", label: "Menú" },
  { href: "/panel/calendario", label: "Días" },
  { href: "/panel/config", label: "Config" },
];

export function AppShell({
  children,
  userNombre,
}: {
  children: React.ReactNode;
  userNombre: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function salir() {
    await fetch("/api/auth/session", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="toastal-shell mx-auto w-full max-w-lg md:max-w-3xl">
      <header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_srgb,#fff8f3_90%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-2xl leading-none text-cacao">
              Tostal
            </p>
            <p className="text-xs text-muted">Operación · {userNombre}</p>
          </div>
          <button
            type="button"
            onClick={salir}
            className="btn btn-ghost text-sm text-muted"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
            Salir
          </button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 text-xs">
          {moreLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-full px-2.5 py-1 ${
                pathname.startsWith(l.href)
                  ? "bg-arena text-cacao"
                  : "text-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">{children}</main>

      <nav className="nav-bottom">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 sm:grid-cols-7">
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/panel" && pathname.startsWith(l.href));
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] ${
                  active ? "bg-arena text-cacao" : "text-muted"
                }`}
              >
                <Icon size={18} />
                <span>{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
