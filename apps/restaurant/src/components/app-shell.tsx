"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Únicos módulos del nav (contrato 6 módulos). */
const links = [
  { href: "/productos", label: "Productos", icon: UtensilsCrossed },
  { href: "/almacen", label: "Almacén", icon: Package },
  { href: "/compras", label: "Compras", icon: ShoppingBag },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/reservaciones", label: "Reservas", icon: CalendarDays },
] as const;

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
    const supabase = createClient();
    await supabase.auth.signOut();
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
          <div className="flex items-center gap-1">
            <Link
              href="/ajustes"
              aria-label="Ajustes"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings size={16} strokeWidth={1.75} />
            </Link>
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
        </div>
      </header>

      <main className="flex-1 px-5 py-6 pb-28">{children}</main>

      <nav className="nav-bottom" aria-label="Módulos">
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-0.5">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(`${l.href}/`);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-h-[3.1rem] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[9px] font-medium transition-colors sm:text-[11px] ${
                  active
                    ? "bg-secondary text-miel"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.65} />
                <span className="truncate">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
