"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, formatoMoneda, labelFecha } from "@/lib/api";

type Pedido = {
  codigo: string;
  estado: string;
  estadoPago: string;
  metodoPago: string;
  modoEntrega: string;
  fechaEntrega: string;
  clienteNombre: string;
  total: number;
  costoEnvio: number;
  subtotal: number;
  lineas: Array<{
    productoNombre: string;
    cantidad: number;
    subtotal: number;
  }>;
};

const PASOS = [
  "recibido",
  "confirmado",
  "en_produccion",
  "listo",
  "entregado",
] as const;

export default function PedidoPage() {
  const params = useParams<{ codigo: string }>();
  const codigo = params.codigo;
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await apiGet<{ pedido: Pedido }>(
          `/api/public/pedidos?codigo=${encodeURIComponent(codigo)}`
        );
        if (alive) setPedido(data.pedido);
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Pedido no encontrado");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
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
        <Link href="/" className="btn btn-primary mt-4 inline-flex">
          Volver al menú
        </Link>
      </div>
    );
  }

  const idx = PASOS.indexOf(
    pedido.estado as (typeof PASOS)[number]
  );
  const cancelado = pedido.estado === "cancelado";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8">
      <p className="text-sm uppercase tracking-[0.15em] text-muted">Tostal</p>
      <h1 className="font-display mt-1 text-4xl">Pedido {pedido.codigo}</h1>
      <p className="mt-2 text-sm text-muted">
        Hola {pedido.clienteNombre}. Para {labelFecha(pedido.fechaEntrega)} ·{" "}
        {pedido.modoEntrega}
      </p>

      <section className="surface mt-6 p-4">
        {cancelado ? (
          <p className="font-semibold text-error">Pedido cancelado</p>
        ) : (
          <ol className="space-y-3">
            {PASOS.map((paso, i) => {
              const done = idx >= i;
              return (
                <li key={paso} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-miel text-white"
                        : "bg-arena text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={done ? "font-semibold" : "text-muted"}>
                    {paso.replace("_", " ")}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-4 text-sm text-muted">
          Pago: {pedido.metodoPago} · {pedido.estadoPago}
        </p>
      </section>

      <section className="surface mt-4 p-4">
        <h2 className="font-semibold">Detalle</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {pedido.lineas.map((l, i) => (
            <li key={i} className="flex justify-between gap-2">
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

      <Link href="/" className="btn btn-secondary mt-6 inline-flex w-full">
        Pedir otra vez
      </Link>
    </div>
  );
}
