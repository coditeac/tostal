"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";
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
              : "No se pudo cargar el calendario. ¿Está corriendo la App Restaurant?"
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
          <p className="relative z-10 mt-5 max-w-[20rem] text-[11px] leading-snug text-[#d6d2c4]/80">
            Retiro: {menu.config.direccionRetiro}
          </p>
        )}
      </header>

      <div className="px-5 pt-4">
        <SiteHeader compact />
      </div>

      <main className="space-y-6 px-5 pb-32 pt-4">
        <section
          className="rise-in"
          style={{ animationDelay: "80ms" }}
        >
          <h2 className="text-lg font-semibold tracking-tight">¿Para qué día?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            El menú solo muestra lo disponible ese día.
          </p>
          <div className="-mx-1 mt-4 flex gap-2.5 overflow-x-auto px-1 pb-1">
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
                  <p className="font-semibold">{d.fecha.slice(8)}</p>
                </button>
              );
            })}
          </div>
          {menu && (
            <p className="mt-3.5 text-xs leading-relaxed text-muted">
              {menu.abierto && menu.deadlineVigente
                ? `Pedidos abiertos hasta ${labelDeadline(menu.deadlinePedido)}`
                : "Ya cerramos pedidos para este día"}
            </p>
          )}
        </section>

        {toast && (
          <div className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-50 -translate-x-1/2 rounded-full bg-miel px-4 py-2.5 text-sm font-medium text-[#d6d2c4] shadow-lg">
            {toast}
          </div>
        )}

        {error && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-error">
            {error}
          </p>
        )}

        {loading ? (
          <p className="loading-pulse text-muted">Cargando menú del día…</p>
        ) : !menu ? null : !menu.config.canalRemotoActivo ? (
          <p className="surface p-4 text-sm text-muted">
            Por ahora no estamos tomando pedidos en línea.
          </p>
        ) : !menu.abierto || !menu.deadlineVigente ? (
          <p className="surface p-4 text-sm text-muted">
            Ya cerramos pedidos para este día. Elige otra fecha.
          </p>
        ) : menu.productos.length === 0 ? (
          <p className="surface p-4 text-sm text-muted">
            No hay productos disponibles para este día.
          </p>
        ) : (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
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

            <ul className="divide-y divide-border overflow-hidden rounded-[1rem] border border-border bg-white">
              {productosFiltrados.map((p, idx) => (
                <li
                  key={p.id}
                  className="rise-in flex gap-3.5 p-3.5"
                  style={{ animationDelay: `${80 + idx * 35}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{p.nombre}</p>
                    {p.categoriaNombre && (
                      <p className="mt-0.5 text-xs text-muted">
                        {p.categoriaNombre}
                      </p>
                    )}
                    {p.descripcion && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {p.descripcion}
                      </p>
                    )}
                    {p.alergenos && (
                      <p className="mt-1 text-[11px] text-muted">
                        Alérgenos: {p.alergenos}
                      </p>
                    )}
                    <p className="mt-2 font-semibold">
                      {formatoMoneda(p.precio, menu.config.moneda)}
                    </p>
                  </div>
                  <div className="menu-thumb" aria-hidden>
                    <span className="pb-5">{p.nombre.split(" ")[0]}</span>
                    <button
                      type="button"
                      className="menu-add"
                      onClick={() => add(p)}
                      aria-label={`Agregar ${p.nombre}`}
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="pb-2 pt-2 text-center text-sm text-muted">
          ¿Ya pediste?{" "}
          <Link href="/seguimiento" className="font-semibold text-miel">
            Sigue tu pedido
          </Link>
        </p>
      </main>

      {cart.totalItems > 0 && (
        <div className="cart-bar">
          <Link
            href="/carrito"
            className="btn btn-primary mx-auto flex w-full max-w-lg justify-between shadow-[0_10px_28px_rgba(154,46,37,0.28)]"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag size={18} />
              Ver carrito · {cart.totalItems}
            </span>
            <span>{formatoMoneda(cart.subtotal)}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
