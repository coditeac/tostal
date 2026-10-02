"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, ShoppingBag } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/components/cart-provider";
import { ProductDetailSheet } from "@/components/product-detail-sheet";
import { ProductImage, resolveFotoUrl } from "@/components/product-image";
import { SiteHeader } from "@/components/site-header";
import {
  fetchMenuHoy,
  formatoMoneda,
  hoyISO,
  labelDeadline,
  labelFecha,
} from "@/lib/api";
import type { MenuHoy, MenuProducto } from "@/lib/contract";

export default function ClienteHome() {
  const cart = useCart();
  const [menu, setMenu] = useState<MenuHoy | null>(null);
  const [categoria, setCategoria] = useState<string>("todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<MenuProducto | null>(null);

  const hoy = hoyISO();

  useEffect(() => {
    if (cart.fecha !== hoy) cart.setFecha(hoy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMenuHoy();
        if (!alive) return;
        setMenu(data);
        setCategoria("todas");
        if (cart.fecha !== data.fecha) cart.setFecha(data.fecha);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Error al cargar menú");
        setMenu(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productosFiltrados = useMemo(() => {
    if (!menu) return [];
    if (categoria === "todas") return menu.productos;
    return menu.productos.filter((p) => p.categoriaId === categoria);
  }, [menu, categoria]);

  function add(p: MenuProducto, qty = 1) {
    if (!menu?.aceptaPedidos) return;
    cart.addItem(
      {
        productoId: p.id,
        nombre: p.nombre,
        precio: p.precio,
        fotoUrl: resolveFotoUrl(p),
      },
      qty
    );
    setToast(qty > 1 ? `${p.nombre} ×${qty}` : `${p.nombre} agregado`);
    window.setTimeout(() => setToast(null), 1600);
  }

  const cerrado = menu != null && !menu.aceptaPedidos;
  const sinProductos = menu != null && menu.productos.length === 0;
  /** Cerrado por staff (día no abierto) vs por hora límite. */
  const cerradoPorHorario =
    cerrado && menu != null && menu.deadlineVigente === false;

  function mensajeCerrado(): string {
    if (!menu) return "";
    if (sinProductos) {
      return "Hoy aún no hay menú del día. Cocina activa los productos en Restaurant → Menú del día. Mientras, puedes reservar.";
    }
    if (cerradoPorHorario && menu.horaLimite) {
      return `Cerramos pedidos a las ${labelDeadline(menu.horaLimite)} (hora CDMX). Puedes reservar para otra fecha.`;
    }
    if (cerradoPorHorario) {
      return "Ya cerramos pedidos de hoy. Puedes reservar para otra fecha.";
    }
    // día con productos pero acepta_pedidos=false y deadline aún vigente
    return "Hoy el menú aún no está abierto a pedidos. Vuelve en un momento o reserva.";
  }

  return (
    <div className="page-shell">
      <header className="hero-brand rise-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tostal-logo.png"
          alt="Tostal — Sabores que unen culturas"
          className="hero-logo float-y"
          width={560}
          height={240}
        />
        {menu?.config.direccionRetiro && (
          <p className="relative z-10 mt-6 max-w-[18rem] text-[11px] leading-relaxed text-[#d6d2c4]/75">
            Retiro: {menu.config.direccionRetiro}
          </p>
        )}
      </header>

      <div className="px-6 pt-5">
        <SiteHeader compact />
      </div>

      <main className="space-y-10 px-6 pb-36 pt-6">
        <section className="section-block rise-in" style={{ animationDelay: "80ms" }}>
          <h2 className="section-title">Menú de hoy</h2>
          <p className="section-lead">
            {labelFecha(menu?.fecha || hoy)} · productos activos para pedir ahora.
          </p>
          {menu?.horaLimite && menu.aceptaPedidos && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Pedidos abiertos hasta las {labelDeadline(menu.horaLimite)} (hora
              CDMX)
            </p>
          )}
          {cerrado && (
            <p className="mt-4 text-xs leading-relaxed text-[var(--tostal-alerta,#A85B12)]">
              {mensajeCerrado()}
            </p>
          )}
          <div className="mt-5">
            <Link
              href="/reservas"
              className="inline-flex items-center gap-2 text-sm font-semibold text-miel transition-opacity hover:opacity-80"
            >
              <CalendarClock size={16} strokeWidth={2} />
              Reservar para otra fecha
            </Link>
          </div>
        </section>

        {toast && (
          <Badge
            variant="default"
            size="xl"
            radius="default"
            className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-50 -translate-x-1/2 px-4 py-2.5 text-sm"
          >
            {toast}
          </Badge>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : !menu ? null : !menu.config.canalRemotoActivo ? (
          <p className="empty-state">
            Por ahora no estamos tomando pedidos en línea.
          </p>
        ) : sinProductos ? (
          <div className="space-y-4">
            <p className="empty-state">{mensajeCerrado()}</p>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/reservas">Ir a reservas</Link>
            </Button>
          </div>
        ) : (
          <section className="section-block">
            {cerrado && (
              <Alert className="mb-4 border-alerta/40 bg-amber-50 text-alerta">
                <AlertDescription>
                  {mensajeCerrado()}{" "}
                  <Link href="/reservas" className="font-semibold underline">
                    Ir a reservas
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            <div className="-mx-1 flex gap-0 overflow-x-auto border-b border-border px-1">
              <button
                type="button"
                onClick={() => setCategoria("todas")}
                className={`chip-cat ${
                  categoria === "todas" ? "chip-cat-active" : "chip-cat-idle"
                }`}
              >
                Todas
              </button>
              {menu.categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoria(c.id)}
                  className={`chip-cat ${
                    categoria === c.id ? "chip-cat-active" : "chip-cat-idle"
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>

            <ul className="list-plain mt-1">
              {productosFiltrados.map((p, idx) => (
                <li
                  key={p.id}
                  className="rise-in flex items-center gap-3 py-4"
                  style={{ animationDelay: `${60 + idx * 30}ms` }}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setDetalle(p)}
                  >
                    <p className="font-semibold leading-snug tracking-tight">
                      {p.nombre}
                    </p>
                    {p.descripcion && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {p.descripcion}
                      </p>
                    )}
                    {p.alergenos && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Alérgenos: {p.alergenos}
                      </p>
                    )}
                    <p className="mt-2.5 text-[0.95rem] font-semibold tabular-nums">
                      {formatoMoneda(p.precio, menu.config.moneda)}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="shrink-0"
                    onClick={() => setDetalle(p)}
                    aria-label={`Ver ${p.nombre}`}
                  >
                    <ProductImage
                      src={resolveFotoUrl(p)}
                      alt={p.nombre}
                      size="md"
                      fallbackLabel={p.nombre}
                    />
                  </button>
                  <button
                    type="button"
                    className="menu-add"
                    onClick={(e) => {
                      e.stopPropagation();
                      add(p, 1);
                    }}
                    disabled={cerrado}
                    aria-label={
                      cerrado
                        ? `${p.nombre} (pedidos cerrados)`
                        : `Agregar ${p.nombre}`
                    }
                  >
                    <Plus size={18} strokeWidth={2.25} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pb-2 text-center text-sm text-muted-foreground">
          ¿Ya pediste?{" "}
          <Link href="/seguimiento" className="font-semibold text-miel">
            Sigue tu pedido
          </Link>
        </p>
      </main>

      {cart.totalItems > 0 && (
        <div className="cart-bar cart-bar-enter">
          <Button
            asChild
            size="lg"
            className="mx-auto flex w-full max-w-lg justify-between shadow-[0_10px_28px_rgba(154,46,37,0.22)]"
          >
            <Link href="/carrito">
              <span className="inline-flex items-center gap-2">
                <ShoppingBag size={18} />
                Ver carrito · {cart.totalItems}
              </span>
              <span className="tabular-nums">{formatoMoneda(cart.subtotal)}</span>
            </Link>
          </Button>
        </div>
      )}

      <ProductDetailSheet
        product={detalle}
        open={Boolean(detalle)}
        onOpenChange={(open) => {
          if (!open) setDetalle(null);
        }}
        moneda={menu?.config.moneda}
        disabled={cerrado}
        onAdd={add}
      />
    </div>
  );
}
