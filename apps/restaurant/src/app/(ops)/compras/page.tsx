"use client";

import { useEffect, useState } from "react";
import { formatoMoneda } from "@/lib/format";

type Item = {
  insumoId: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  cantidadSugerida: number;
  proveedor: string | null;
  motivo: string;
  costoUnitario: number;
  cantidad?: number;
};

type Carrito = {
  id: string;
  proveedor: string | null;
  estado: string;
  total: number;
  lineas: Array<{
    id: string;
    nombre: string;
    unidad: string;
    cantidad: number;
    costoUnitario: number;
    comprada: boolean;
  }>;
};

export default function ComprasPage() {
  const [sugerencia, setSugerencia] = useState<Item[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [carrito, setCarrito] = useState<Carrito | null>(null);
  const [carritos, setCarritos] = useState<Array<{ id: string; estado: string; total: number; proveedor: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compras");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const sug = data.sugerencia || [];
      setSugerencia(sug);
      setCantidades(
        Object.fromEntries(
          sug.map((s: Item) => [s.insumoId, String(s.cantidadSugerida)])
        )
      );
      setCarritos(data.carritos || []);
      if (data.carritos?.[0] && !carrito) {
        const cRes = await fetch(`/api/compras?carritoId=${data.carritos[0].id}`);
        const cData = await cRes.json();
        if (cRes.ok) setCarrito(cData.carrito);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generarListaYCarrito() {
    setBusy(true);
    setError(null);
    try {
      const items = sugerencia
        .filter((s) => Number(cantidades[s.insumoId]) > 0)
        .map((s) => ({
          insumoId: s.insumoId,
          cantidad: Number(cantidades[s.insumoId]),
          proveedor: s.proveedor,
        }));
      if (!items.length) throw new Error("Nada que comprar.");
      const listaRes = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "crear_lista", items }),
      });
      const listaData = await listaRes.json();
      if (!listaRes.ok) throw new Error(listaData.error || "Error al crear lista");

      const cartRes = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "crear_carrito_desde_lista",
          listaId: listaData.lista.id,
          proveedor: items[0]?.proveedor,
        }),
      });
      const cartData = await cartRes.json();
      if (!cartRes.ok) throw new Error(cartData.error || "Error al crear carrito");
      setCarrito(cartData.carrito);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function marcarComprada() {
    if (!carrito) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "marcar_comprada",
          carritoId: carrito.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setCarrito(data.carrito);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="loading-pulse text-muted-foreground">Calculando compras…</p>;
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Compras</h1>
        <p className="text-sm text-muted-foreground">
          Lista sugerida → carrito proveedor → entrada de stock
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Lista sugerida</h2>
        {sugerencia.length === 0 ? (
          <p className="surface p-4 text-sm text-muted-foreground">
            Todo en orden: no hay faltantes ni demanda pendiente.
          </p>
        ) : (
          <ul className="space-y-2">
            {sugerencia.map((s) => (
              <li key={s.insumoId} className="surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock {s.stockActual} {s.unidad} · mín {s.stockMinimo} ·{" "}
                      {s.motivo.replace("_", " ")}
                    </p>
                    {s.proveedor && (
                      <p className="text-xs text-muted-foreground">{s.proveedor}</p>
                    )}
                  </div>
                  <div className="w-24">
                    <label className="label">Cant.</label>
                    <input
                      className="field"
                      type="number"
                      value={cantidades[s.insumoId] || ""}
                      onChange={(e) =>
                        setCantidades({
                          ...cantidades,
                          [s.insumoId]: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {sugerencia.length > 0 && (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={generarListaYCarrito}
          >
            {busy ? "Armando…" : "Pasar a carrito proveedor"}
          </button>
        )}
      </section>

      {carrito && (
        <section className="surface space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Carrito proveedor</h2>
            <span className="rounded-full bg-arena px-2 py-0.5 text-xs">
              {carrito.estado}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {carrito.proveedor || "Sin proveedor"} ·{" "}
            {formatoMoneda(carrito.total)}
          </p>
          <ul className="space-y-2 text-sm">
            {carrito.lineas.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span>
                  {l.nombre} · {l.cantidad} {l.unidad}
                  {l.comprada ? " ✓" : ""}
                </span>
                <span>{formatoMoneda(Math.round(l.cantidad * l.costoUnitario))}</span>
              </li>
            ))}
          </ul>
          {carrito.estado !== "comprada" && (
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={busy}
              onClick={marcarComprada}
            >
              {busy ? "Registrando…" : "Marcar comprada (entra stock)"}
            </button>
          )}
          {carrito.estado === "comprada" && (
            <p className="text-sm text-ok">
              Compra registrada: stock actualizado y gasto de insumos anotado.
            </p>
          )}
        </section>
      )}

      {carritos.length > 1 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Historial</h2>
          <ul className="space-y-1 text-sm">
            {carritos.slice(0, 8).map((c) => (
              <li key={c.id} className="surface flex justify-between p-3">
                <span>
                  {c.proveedor || "Proveedor"} · {c.estado}
                </span>
                <span>{formatoMoneda(c.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
