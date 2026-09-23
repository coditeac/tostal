"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChefHat,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ShoppingBag,
  Wheat,
  Settings,
} from "lucide-react";

const links = [
  { href: "/panel", label: "Inicio", icon: LayoutDashboard },
  { href: "/panel/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/panel/productos", label: "Menú", icon: ChefHat },
  { href: "/panel/insumos", label: "Insumos", icon: Wheat },
  { href: "/panel/calendario", label: "Días", icon: CalendarDays },
  { href: "/panel/whatsapp", label: "Avisos", icon: MessageCircle },
  { href: "/panel/config", label: "Config", icon: Settings },
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
      </header>

      <main className="flex-1 px-4 py-4 pb-28">{children}</main>

      <nav className="nav-bottom">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 md:grid-cols-7">
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
