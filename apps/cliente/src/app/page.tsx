"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/components/cart-provider";
import { SiteHeader } from "@/components/site-header";
import {
  fetchDias,
  fetchMenu,
  formatoMoneda,
  hoyISO,
  labelDeadline,
  labelFecha,
} from "@/lib/api";
import type { MenuDiaResponse } from "@tostal/shared/types";
import type { PublicDiasResponse } from "@tostal/shared/api-public";

type DiaOpt = PublicDiasResponse["dias"][number];

export default function ClienteHome() {
  const cart = useCart();
  const [dias, setDias] = useState<DiaOpt[]>([]);
  const [menu, setMenu] = useState<MenuDiaResponse | null>(null);
  const [categoria, setCategoria] = useState<string>("todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fecha = cart.fecha || hoyISO();

  useEffect(() => {
    if (!cart.fecha) cart.setFecha(hoyISO());
    // Solo al montar: evitar loop por identidad de cart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchDias();
        if (!alive) return;
        const abiertos = data.dias.filter((d) => d.abierto && d.deadlineVigente);
        setDias(abiertos);
        if (abiertos.length && !abiertos.some((d) => d.fecha === cart.fecha)) {
          cart.setFecha(abiertos[0].fecha);
        }
      } catch (e) {
        if (alive) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo cargar el calendario. Revisa la conexión con la API."
          );
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMenu(fecha);
        if (!alive) return;
        setMenu(data);
        setCategoria("todas");
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
  }, [fecha]);

  const productosFiltrados = useMemo(() => {
    if (!menu) return [];
    if (categoria === "todas") return menu.productos;
    return menu.productos.filter((p) => p.categoriaId === categoria);
  }, [menu, categoria]);

  function add(p: MenuDiaResponse["productos"][number]) {
    if (!menu?.abierto || !menu.deadlineVigente) return;
    cart.addItem({
      productoId: p.id,
      nombre: p.nombre,
      precio: p.precio,
    });
    setToast(`${p.nombre} agregado`);
    window.setTimeout(() => setToast(null), 1600);
  }

  const diasUi: DiaOpt[] =
    dias.length > 0
      ? dias
      : [
          {
            id: "fallback",
            fecha,
            abierto: true,
            deadlinePedido: "",
            cupoMaximo: null,
            notas: null,
            deadlineVigente: true,
          },
        ];

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
          <h2 className="section-title">¿Para qué día?</h2>
          <p className="section-lead">
            El menú solo muestra lo disponible ese día.
          </p>
          <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
            {diasUi.map((d) => {
              const active = d.fecha === fecha;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  onClick={() => cart.setFecha(d.fecha)}
                  className={`chip-day ${
                    active ? "chip-day-active" : "chip-day-idle"
                  }`}
                >
                  <p className="text-[11px] opacity-80">
                    {labelFecha(d.fecha)}
                  </p>
                  <p className="font-semibold tabular-nums">{d.fecha.slice(8)}</p>
                </button>
              );
            })}
          </div>
          {menu && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {menu.abierto && menu.deadlineVigente
                ? `Pedidos abiertos hasta ${labelDeadline(menu.deadlinePedido)}`
                : "Ya cerramos pedidos para este día"}
            </p>
          )}
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
        ) : !menu.abierto || !menu.deadlineVigente ? (
          <p className="empty-state">
            Ya cerramos pedidos para este día. Elige otra fecha.
          </p>
        ) : menu.productos.length === 0 ? (
          <p className="empty-state">
            No hay productos disponibles para este día.
          </p>
        ) : (
          <section className="section-block">
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
                  className="rise-in flex items-center gap-3.5 py-4"
                  style={{ animationDelay: `${60 + idx * 30}ms` }}
                >
                  <div className="min-w-0 flex-1">
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
                  </div>
                  <div className="menu-thumb" aria-hidden>
                    <span>{p.nombre.split(" ")[0]}</span>
                  </div>
                  <button
                    type="button"
                    className="menu-add"
                    onClick={() => add(p)}
                    aria-label={`Agregar ${p.nombre}`}
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
            className="mx-auto flex w-full max-w-lg justify-between"
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
    </div>
  );
}
