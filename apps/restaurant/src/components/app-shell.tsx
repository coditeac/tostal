"use client";

import { apiFetch } from "@/lib/api";

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
import { Button } from "@/components/ui/button";

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
  { href: "/panel/reservas", label: "Reservas" },
  { href: "/panel/productos", label: "Menú" },
  { href: "/panel/calendario", label: "Día" },
  { href: "/panel/usuarios", label: "Personal" },
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
    await apiFetch("/api/auth/session", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="toastal-shell mx-auto w-full max-w-lg md:max-w-3xl">
      <header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_srgb,#fafafa_90%,transparent)] px-5 pb-3 pt-[max(0.85rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tostal-logo-marca.png"
              alt="Tostal"
              width={140}
              height={60}
              className="ops-mark"
            />
            <p className="truncate text-xs text-muted-foreground">
              {userNombre}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={salir}
            className="text-muted-foreground"
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Salir
          </Button>
        </div>
        <nav className="mt-3 flex gap-4 overflow-x-auto border-b border-transparent pb-0.5 text-sm">
          {moreLinks.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 border-b-2 pb-2 transition-colors ${
                  active
                    ? "border-miel font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 px-5 py-6 pb-28">{children}</main>

      <nav className="nav-bottom">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-0.5 sm:grid-cols-7">
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/panel" && pathname.startsWith(l.href));
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-h-[3.1rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors sm:text-[11px] ${
                  active
                    ? "bg-secondary text-miel"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.65} />
                <span>{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
