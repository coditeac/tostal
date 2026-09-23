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
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <header className="hero-brand rise-in">
        <div className="relative z-10">
          <p className="text-sm uppercase tracking-[0.2em] text-rosa/90">
            Pedidos
          </p>
          <h1 className="font-display float-y mt-2 text-5xl leading-none">
            Tostal
          </h1>
          <p className="mt-2 max-w-[18rem] text-sm text-crema/90">
            Sabores que unen culturas
          </p>
          {menu?.config.direccionRetiro && (
            <p className="mt-4 text-xs text-crema/75">
              Retiro: {menu.config.direccionRetiro}
            </p>
          )}
        </div>
      </header>

      <div className="px-4 pt-3">
        <SiteHeader compact />
      </div>

      <main className="space-y-4 px-4 pb-28 pt-3">
        <section
          className="surface rise-in p-4"
          style={{ animationDelay: "80ms" }}
        >
          <h2 className="font-semibold">¿Para qué día?</h2>
          <p className="mt-1 text-sm text-muted">
            El menú solo muestra lo disponible ese día.
          </p>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {diasUi.map((d) => {
              const active = d.fecha === fecha;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  onClick={() => cart.setFecha(d.fecha)}
                  className={`min-w-[4.6rem] rounded-2xl px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-cacao text-crema"
                      : "border border-border bg-white text-cacao"
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
            <p className="mt-3 text-xs text-muted">
              {menu.abierto && menu.deadlineVigente
                ? `Pedidos abiertos hasta ${labelDeadline(menu.deadlinePedido)}`
                : "Ya cerramos pedidos para este día"}
            </p>
          )}
        </section>

        {toast && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-cacao px-4 py-2 text-sm text-crema shadow-lg">
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
                className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap ${
                  categoria === "todas"
                    ? "bg-miel text-white"
                    : "border border-border bg-white"
                }`}
              >
                Todas
              </button>
              {menu.categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoria(c.id)}
                  className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap ${
                    categoria === c.id
                      ? "bg-miel text-white"
                      : "border border-border bg-white"
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>

            <ul className="space-y-3">
              {productosFiltrados.map((p, idx) => (
                <li
                  key={p.id}
                  className="surface rise-in flex gap-3 p-3"
                  style={{ animationDelay: `${100 + idx * 40}ms` }}
                >
                  <div
                    className="flex h-20 w-20 shrink-0 items-end justify-center rounded-xl bg-gradient-to-br from-[#e8b48a] to-[#8b4b2a] p-2 text-center text-[10px] font-semibold text-crema"
                    aria-hidden
                  >
                    {p.nombre.split(" ")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold leading-tight">{p.nombre}</p>
                        {p.categoriaNombre && (
                          <p className="text-xs text-muted">
                            {p.categoriaNombre}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 font-semibold">
                        {formatoMoneda(p.precio, menu.config.moneda)}
                      </p>
                    </div>
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
                    <button
                      type="button"
                      className="btn btn-primary mt-2 px-3 py-2 text-sm"
                      onClick={() => add(p)}
                    >
                      <Plus size={16} />
                      Agregar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="pb-2 text-center text-sm text-muted">
          ¿Ya pediste?{" "}
          <Link href="/seguimiento" className="font-semibold text-miel-dark">
            Sigue tu pedido
          </Link>
        </p>
      </main>

      {cart.totalItems > 0 && (
        <div className="cart-bar">
          <Link
            href="/carrito"
            className="btn btn-primary mx-auto flex w-full max-w-lg justify-between shadow-lg"
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
