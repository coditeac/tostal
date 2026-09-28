"use client";

import { apiFetch } from "@/lib/api";

import { useEffect, useState } from "react";
import { formatoMoneda, hoyISO } from "@/lib/format";
import { useRestaurantPedidoEvents } from "@/lib/use-pedido-events";

type Pedido = {
  id: string;
  codigo: string;
  canal: string;
  estado: string;
  clienteNombre: string;
  total: number;
  lineas: Array<{ productoNombre: string; cantidad: number }>;
};

export default function ProduccionPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/produccion?fecha=${fecha}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setPedidos(data.pedidos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fecha]);

  useRestaurantPedidoEvents(fecha, {
    onSnapshot: () => {
      load(true);
      setLive(true);
    },
    onEvent: () => {
      load(true);
      setLive(true);
    },
    onError: () => setLive(false),
  });

  async function accion(pedidoId: string, accion: string, aVitrina = false) {
    setBusyId(pedidoId);
    setError(null);
    try {
      const res = await apiFetch("/api/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, accion, aVitrina }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (accion === "iniciar") {
        setToast("Insumos descontados al iniciar producción");
        setTimeout(() => setToast(null), 2500);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Producción</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cola de cocina · al iniciar se descuentan insumos
          {live ? (
            <span className="ml-2 text-xs font-medium text-ok">● En vivo</span>
          ) : null}
        </p>
      </div>

      <div>
        <label className="label">Fecha</label>
        <input
          type="date"
          className="field"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {toast && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-ok">{toast}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {loading ? (
        <p className="loading-pulse text-muted-foreground">Cargando cola…</p>
      ) : pedidos.length === 0 ? (
        <p className="empty-state">No hay pedidos en cola para esta fecha.</p>
      ) : (
        <ul className="list-plain">
          {pedidos.map((p) => (
            <li key={p.id} className="space-y-3 py-4">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight">{p.codigo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {p.clienteNombre} · {p.canal}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {p.lineas
                      .map((l) => `${l.cantidad}× ${l.productoNombre}`)
                      .join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium capitalize">
                    {p.estado.replace("_", " ")}
                  </p>
                  <p className="text-sm tabular-nums">{formatoMoneda(p.total)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.estado === "recibido" && (
                  <button
                    type="button"
                    className="btn btn-secondary py-2 text-sm"
                    disabled={busyId === p.id}
                    onClick={() => accion(p.id, "confirmar")}
                  >
                    Confirmar
                  </button>
                )}
                {(p.estado === "confirmado" || p.estado === "recibido") && (
                  <button
                    type="button"
                    className="btn btn-primary py-2 text-sm"
                    disabled={busyId === p.id}
                    onClick={() => accion(p.id, "iniciar")}
                  >
                    Iniciar producción
                  </button>
                )}
                {p.estado === "en_produccion" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary py-2 text-sm"
                      disabled={busyId === p.id}
                      onClick={() => accion(p.id, "listo")}
                    >
                      Marcar listo
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary py-2 text-sm"
                      disabled={busyId === p.id}
                      onClick={() => accion(p.id, "listo", true)}
                    >
                      Listo → vitrina
                    </button>
                  </>
                )}
                {p.estado === "listo" && (
                  <button
                    type="button"
                    className="btn btn-secondary py-2 text-sm"
                    disabled={busyId === p.id}
                    onClick={() => accion(p.id, "entregar")}
                  >
                    Entregar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
