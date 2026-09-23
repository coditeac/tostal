"use client";

import { useEffect, useState } from "react";
import { formatoMoneda } from "@/lib/format";

type Producto = {
  id: string;
  nombre: string;
  precio: number;
  costoTeorico: number;
  margenPct: number;
  bajoMargen: boolean;
  receta: Array<{
    insumoNombre?: string;
    cantidad: number;
    unidad?: string;
    costoLinea: number;
  }>;
};

export default function CostosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/costos");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        setProductos(data.productos || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="loading-pulse text-muted">Calculando márgenes…</p>;
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Costos y márgenes</h1>
        <p className="text-sm text-muted">
          Costo teórico por receta vs precio de venta
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {productos.length === 0 ? (
        <p className="text-sm text-muted">No hay productos activos.</p>
      ) : (
        <ul className="space-y-2">
          {productos.map((p) => (
            <li key={p.id} className="surface p-4">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => setOpenId(openId === p.id ? null : p.id)}
              >
                <div>
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="text-xs text-muted">
                    Costo {formatoMoneda(p.costoTeorico)} · venta{" "}
                    {formatoMoneda(p.precio)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-sm font-semibold ${
                    p.bajoMargen
                      ? "bg-amber-100 text-alerta"
                      : "bg-green-50 text-ok"
                  }`}
                >
                  {p.margenPct}%
                </span>
              </button>
              {openId === p.id && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  {p.receta.length === 0 ? (
                    <li className="text-muted">Sin receta cargada.</li>
                  ) : (
                    p.receta.map((r, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          {r.insumoNombre} {r.cantidad}
                          {r.unidad}
                        </span>
                        <span>{formatoMoneda(r.costoLinea)}</span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
