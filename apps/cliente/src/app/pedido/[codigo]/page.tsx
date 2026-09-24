"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchPedido, formatoMoneda, labelFecha } from "@/lib/api";
import { usePedidoEvents } from "@/lib/use-pedido-events";
import {
  ESTADO_PAGO,
  ESTADO_PEDIDO,
  METODO_PAGO,
  MODO_ENTREGA,
  PASOS_PEDIDO,
} from "@/lib/labels";
import type { PedidoPublico } from "@tostal/shared/types";

function PedidoView() {
  const params = useParams<{ codigo: string }>();
  const search = useSearchParams();
  const codigo = params.codigo;
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const stripeHint = search.get("pago") === "stripe";

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await fetchPedido(codigo);
        if (alive) {
          setPedido(data.pedido);
          setError(null);
        }
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Pedido no encontrado");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const t = window.setInterval(() => {
      if (!live) load();
    }, 15000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [codigo, live]);

  usePedidoEvents(codigo, {
    onPedido: (p) => {
      setPedido(p);
      setError(null);
      setLoading(false);
      setLive(true);
    },
    onError: () => setLive(false),
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="loading-pulse text-muted">Buscando tu pedido…</p>
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="page-shell px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Pedido</h1>
        <p className="mt-2 text-error">{error || "No encontrado"}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/seguimiento" className="btn btn-primary inline-flex">
            Buscar otro código
          </Link>
          <Link href="/" className="btn btn-secondary inline-flex">
            Volver al menú
          </Link>
        </div>
      </div>
    );
  }

  const idx = PASOS_PEDIDO.indexOf(pedido.estado);
  const cancelado = pedido.estado === "cancelado";

  return (
    <div className="page-shell px-5 py-8">
      <p className="font-brand text-sm tracking-[0.14em] text-miel">Tostal</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Pedido {pedido.codigo}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Hola {pedido.clienteNombre}. Para {labelFecha(pedido.fechaEntrega)} ·{" "}
        {MODO_ENTREGA[pedido.modoEntrega]}
      </p>
      {live && (
        <p className="mt-2 text-xs font-medium text-ok">
          ● Seguimiento en vivo
        </p>
      )}

      {stripeHint && pedido.metodoPago === "stripe" && (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-ok">
          {pedido.estadoPago === "pagado"
            ? "Pago con tarjeta simulado correctamente (modo demo sin clave Stripe)."
            : "Pago con tarjeta registrado; pendiente de confirmación."}
        </p>
      )}

      {pedido.metodoPago === "transferencia" &&
        pedido.estadoPago === "pendiente" && (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-alerta">
            Transferencia pendiente: te confirmamos el pago cuando lo
            verifiquemos.
          </p>
        )}

      <section className="surface mt-6 p-4">
        {cancelado ? (
          <p className="font-semibold text-error">Pedido cancelado</p>
        ) : (
          <>
            <p className="text-2xl font-semibold leading-tight">
              {ESTADO_PEDIDO[pedido.estado]}
            </p>
            <div className="status-track mt-5">
              {PASOS_PEDIDO.map((paso, i) => {
                const done = idx > i;
                const current = idx === i;
                const last = i === PASOS_PEDIDO.length - 1;
                return (
                  <div key={paso} className="status-step">
                    {!last && (
                      <span
                        className={`status-line ${
                          done || current ? "status-line-done" : ""
                        }`}
                      />
                    )}
                    <span
                      className={`status-dot ${
                        done
                          ? "status-dot-done"
                          : current
                            ? "status-dot-current"
                            : ""
                      }`}
                    />
                    <span
                      className={`max-w-[4.5rem] text-[10px] leading-tight ${
                        current || done
                          ? "font-semibold text-cacao"
                          : "text-muted"
                      }`}
                    >
                      {ESTADO_PEDIDO[paso]}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="mt-5 text-sm text-muted">
          {METODO_PAGO[pedido.metodoPago]} · {ESTADO_PAGO[pedido.estadoPago]}
        </p>
      </section>

      <section className="surface mt-4 p-4">
        <h2 className="font-semibold">Detalle</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {pedido.lineas.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <span>
                {l.cantidad}× {l.productoNombre}
              </span>
              <span>{formatoMoneda(l.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatoMoneda(pedido.subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Envío</span>
            <span>{formatoMoneda(pedido.costoEnvio)}</span>
          </div>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatoMoneda(pedido.total)}</span>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-2">
        <Link href="/" className="btn btn-secondary inline-flex w-full">
          Pedir otra vez
        </Link>
        <Link
          href="/seguimiento"
          className="text-center text-sm font-semibold text-miel"
        >
          Buscar otro pedido
        </Link>
      </div>
    </div>
  );
}

export default function PedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10">
          <p className="loading-pulse text-muted">Buscando tu pedido…</p>
        </div>
      }
    >
      <PedidoView />
    </Suspense>
  );
}
