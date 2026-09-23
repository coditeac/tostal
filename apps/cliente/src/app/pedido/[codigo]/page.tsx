"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchPedido, formatoMoneda, labelFecha } from "@/lib/api";
import {
  ESTADO_PAGO,
  ESTADO_PEDIDO,
  METODO_PAGO,
  MODO_ENTREGA,
  PASOS_PEDIDO,
} from "@/lib/labels";
import type { PedidoPublico } from "../../../../../shared/types";

function PedidoView() {
  const params = useParams<{ codigo: string }>();
  const search = useSearchParams();
  const codigo = params.codigo;
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    const t = window.setInterval(load, 8000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [codigo]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="loading-pulse text-muted">Buscando tu pedido…</p>
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-3xl">Pedido</h1>
        <p className="mt-2 text-error">{error || "No encontrado"}</p>
        <div className="mt-4 flex flex-col gap-2">
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
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8">
      <p className="text-sm uppercase tracking-[0.15em] text-muted">Tostal</p>
      <h1 className="font-display mt-1 text-4xl">Pedido {pedido.codigo}</h1>
      <p className="mt-2 text-sm text-muted">
        Hola {pedido.clienteNombre}. Para {labelFecha(pedido.fechaEntrega)} ·{" "}
        {MODO_ENTREGA[pedido.modoEntrega]}
      </p>

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
          <ol className="space-y-3">
            {PASOS_PEDIDO.map((paso, i) => {
              const done = idx >= i;
              const current = idx === i;
              return (
                <li key={paso} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-miel text-white"
                        : "bg-arena text-muted"
                    } ${current ? "ring-2 ring-miel/40 ring-offset-2" : ""}`}
                  >
                    {i + 1}
                  </span>
                  <span className={done ? "font-semibold" : "text-muted"}>
                    {ESTADO_PEDIDO[paso]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-4 text-sm text-muted">
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
          className="text-center text-sm font-semibold text-miel-dark"
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
