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
import { Badge } from "@/components/reui/badge";
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
    await apiFetch("/api/auth/session", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="toastal-shell mx-auto w-full max-w-lg md:max-w-3xl">
      <header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_srgb,#f7f5f0_92%,transparent)] px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tostal-logo-marca.png"
              alt="Tostal"
              width={140}
              height={60}
              className="ops-mark"
            />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                Operación · {userNombre}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={salir}
            className="text-muted-foreground"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
            Salir
          </Button>
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 text-xs">
          {moreLinks.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Badge
                key={l.href}
                asChild
                variant={active ? "default" : "secondary"}
                radius="full"
                size="lg"
                className={active ? "" : "bg-arena/80 text-muted-foreground"}
              >
                <Link href={l.href}>{l.label}</Link>
              </Badge>
            );
          })}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">{children}</main>

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
                className={`flex min-h-[3.15rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium sm:text-[11px] ${
                  active ? "bg-arena text-miel" : "text-muted-foreground"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.35 : 1.75} />
                <span>{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
