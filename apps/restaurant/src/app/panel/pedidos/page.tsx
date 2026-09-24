"use client";

import { useCallback, useEffect, useState } from "react";
import { formatoMoneda, hoyISO } from "@/lib/format";
import { useRestaurantPedidoEvents } from "@/lib/use-pedido-events";
import type { PedidoPublico } from "../../../../../../shared/types";

type Pedido = PedidoPublico;

const ESTADOS = [
  "recibido",
  "confirmado",
  "en_produccion",
  "listo",
  "entregado",
  "cancelado",
] as const;

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const mergePedido = useCallback(
    (p: Pedido) => {
      setPedidos((prev) => {
        if (p.fechaEntrega !== fecha) {
          return prev.filter((x) => x.id !== p.id);
        }
        const idx = prev.findIndex((x) => x.id === p.id);
        if (idx === -1) return [p, ...prev];
        const next = [...prev];
        next[idx] = p;
        return next;
      });
    },
    [fecha]
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pedidos?fecha=${fecha}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setPedidos(data.pedidos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fecha]);

  useRestaurantPedidoEvents(fecha, {
    onSnapshot: (list) => {
      setPedidos(list);
      setLoading(false);
      setLive(true);
    },
    onEvent: (_type, pedido) => {
      mergePedido(pedido);
      setLive(true);
    },
    onError: () => setLive(false),
  });

  async function patch(id: string, body: Record<string, string>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.pedido) mergePedido(data.pedido);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Pedidos</h1>
        <p className="text-sm text-muted">
          Cola del día · producción y pagos
          {live ? (
            <span className="ml-2 text-xs font-medium text-ok">● En vivo</span>
          ) : null}
        </p>
      </div>

      <div>
        <label className="label">Fecha de entrega</label>
        <input
          type="date"
          className="field"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="loading-pulse text-muted">Cargando pedidos…</p>
      ) : pedidos.length === 0 ? (
        <p className="surface p-4 text-sm text-muted">
          No hay pedidos para esta fecha.
        </p>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <li key={p.id} className="surface space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.codigo}</p>
                  <p className="text-sm text-muted">
                    {p.clienteNombre} · {p.clienteTelefono}
                  </p>
                  <p className="text-xs text-muted">
                    {p.canal} · {p.modoEntrega} · {p.metodoPago}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatoMoneda(p.total)}</p>
                  <p className="text-xs text-muted">{p.estadoPago}</p>
                </div>
              </div>
              <p className="text-sm">
                {p.lineas
                  .map((l) => `${l.cantidad}× ${l.productoNombre}`)
                  .join(" · ")}
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  className="field max-w-[11rem] py-2"
                  value={p.estado}
                  disabled={busyId === p.id}
                  onChange={(e) => patch(p.id, { estado: e.target.value })}
                >
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e.replace("_", " ")}
                    </option>
                  ))}
                </select>
                {p.estadoPago === "pendiente" &&
                  p.metodoPago === "transferencia" && (
                    <button
                      type="button"
                      className="btn btn-secondary py-2 text-sm"
                      disabled={busyId === p.id}
                      onClick={() => patch(p.id, { estadoPago: "pagado" })}
                    >
                      Marcar pagado
                    </button>
                  )}
              </div>
              <p className="text-xs text-muted">
                Al pasar a «en producción» se descuentan insumos de la receta.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
