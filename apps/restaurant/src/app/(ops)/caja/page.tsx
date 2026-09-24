"use client";

import { apiFetch } from "@/lib/api";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatoMoneda, hoyISO } from "@/lib/format";
import { useRestaurantPedidoEvents } from "@/lib/use-pedido-events";

type Producto = { id: string; nombre: string; precio: number };
type Vitrina = {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
};
type ColaItem = {
  id: string;
  codigo: string;
  fichaCodigo: string | null;
  estado: string;
  clienteNombre: string;
  total: number;
  lineas: Array<{ productoNombre: string; cantidad: number }>;
};
type Turno = {
  id: string;
  abiertoEn: string;
  totalEfectivo: number;
  totalOtros: number;
  contadorFichas: number;
};

type LineaDraft = { productoId: string; cantidad: number; desdeVitrina: boolean };

export default function CajaPage() {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [vitrina, setVitrina] = useState<Vitrina[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [canalActivo, setCanalActivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paso, setPaso] = useState<"pedir" | "pagar" | "ficha">("pedir");
  const [lineas, setLineas] = useState<LineaDraft[]>([]);
  const [metodoPago, setMetodoPago] = useState("efectivo_mostrador");
  const [clienteNombre, setClienteNombre] = useState("");
  const [fichaEmitida, setFichaEmitida] = useState<string | null>(null);
  const [fichaBuscar, setFichaBuscar] = useState("");
  const [tab, setTab] = useState<"venta" | "cola" | "vitrina">("venta");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/caja");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setTurno(data.turno);
      setCola(data.cola || []);
      setVitrina(data.vitrina || []);
      setProductos(data.productos || []);
      setCanalActivo(!!data.canalMostradorActivo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useRestaurantPedidoEvents(hoyISO(), {
    onEvent: () => {
      load(true);
    },
  });

  const subtotal = useMemo(() => {
    return lineas.reduce((acc, l) => {
      const p = productos.find((x) => x.id === l.productoId);
      return acc + (p ? p.precio * l.cantidad : 0);
    }, 0);
  }, [lineas, productos]);

  function addProducto(productoId: string, desdeVitrina: boolean) {
    setLineas((prev) => {
      const existing = prev.find(
        (l) => l.productoId === productoId && l.desdeVitrina === desdeVitrina
      );
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      return [...prev, { productoId, cantidad: 1, desdeVitrina }];
    });
    setPaso("pedir");
    setFichaEmitida(null);
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.turno) setTurno(data.turno);
      if (data.cola) setCola(data.cola);
      if (data.vitrina) setVitrina(data.vitrina);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function cobrarYFicha() {
    setPaso("pagar");
    const data = await post({
      accion: "crear_pedido",
      lineas,
      metodoPago,
      clienteNombre: clienteNombre || undefined,
    });
    if (data?.fichaCodigo) {
      setFichaEmitida(data.fichaCodigo);
      setPaso("ficha");
      setLineas([]);
      setClienteNombre("");
      setTab("cola");
    }
  }

  async function entregar() {
    const data = await post({ accion: "entregar", fichaCodigo: fichaBuscar });
    if (data) setFichaBuscar("");
  }

  if (loading) {
    return <p className="loading-pulse text-muted-foreground">Abriendo caja…</p>;
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Caja / mostrador</h1>
        <p className="text-sm text-muted-foreground">
          Pedir → pagar → ficha → llevar pedido · sin mesas
        </p>
      </div>

      {!canalActivo && (
        <p className="surface border-alerta/40 p-4 text-sm">
          El canal mostrador está apagado.{" "}
          <Link href="/panel/config" className="font-semibold text-miel-dark">
            Actívalo en Config
          </Link>{" "}
          para vender en caja.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</p>
      )}

      <section className="surface flex flex-wrap items-center justify-between gap-2 p-4">
        {turno ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Turno abierto</p>
              <p className="text-sm font-medium">
                Efectivo {formatoMoneda(turno.totalEfectivo)} · Otros{" "}
                {formatoMoneda(turno.totalOtros)}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary py-2 text-sm"
              disabled={busy}
              onClick={() => post({ accion: "cerrar_turno" })}
            >
              Cerrar turno
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() => post({ accion: "abrir_turno" })}
          >
            Abrir turno
          </button>
        )}
      </section>

      <div className="flex gap-2">
        {(
          [
            ["venta", "Venta"],
            ["cola", "Cola"],
            ["vitrina", "Vitrina"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === k ? "bg-cacao text-crema" : "surface"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "venta" && (
        <section className="space-y-3">
          <div className="flex gap-2 text-xs">
            {(["pedir", "pagar", "ficha"] as const).map((p, i) => (
              <span
                key={p}
                className={`rounded-full px-2 py-1 capitalize ${
                  paso === p ? "bg-miel text-white" : "bg-arena text-muted-foreground"
                }`}
              >
                {i + 1}. {p}
              </span>
            ))}
          </div>

          <div>
            <label className="label">Nombre (opcional)</label>
            <input
              className="field"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Cliente mostrador"
            />
          </div>

          <div>
            <p className="label">Menú rápido</p>
            <div className="grid grid-cols-2 gap-2">
              {productos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="surface p-3 text-left text-sm"
                  disabled={!canalActivo || !turno}
                  onClick={() => addProducto(p.id, false)}
                >
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-muted-foreground">{formatoMoneda(p.precio)}</p>
                </button>
              ))}
            </div>
          </div>

          {vitrina.some((v) => v.cantidad > 0) && (
            <div>
              <p className="label">Desde vitrina</p>
              <div className="grid grid-cols-2 gap-2">
                {vitrina
                  .filter((v) => v.cantidad > 0)
                  .map((v) => (
                    <button
                      key={v.productoId}
                      type="button"
                      className="surface border-ok/30 p-3 text-left text-sm"
                      disabled={!canalActivo || !turno}
                      onClick={() => addProducto(v.productoId, true)}
                    >
                      <p className="font-medium">{v.nombre}</p>
                      <p className="text-muted-foreground">
                        {v.cantidad} u · {formatoMoneda(v.precio)}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {lineas.length > 0 && (
            <div className="surface space-y-2 p-4">
              <h2 className="font-semibold">Pedido</h2>
              <ul className="space-y-1 text-sm">
                {lineas.map((l, idx) => {
                  const p = productos.find((x) => x.id === l.productoId);
                  return (
                    <li key={idx} className="flex justify-between">
                      <span>
                        {l.cantidad}× {p?.nombre}
                        {l.desdeVitrina ? " (vitrina)" : ""}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground"
                        onClick={() =>
                          setLineas(lineas.filter((_, i) => i !== idx))
                        }
                      >
                        Quitar
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-lg font-semibold">{formatoMoneda(subtotal)}</p>
              <div>
                <label className="label">Pago</label>
                <select
                  className="field"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                >
                  <option value="efectivo_mostrador">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="stripe">Tarjeta / Stripe</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy || !turno || !canalActivo}
                onClick={cobrarYFicha}
              >
                {busy ? "Cobrando…" : "Pagar y emitir ficha"}
              </button>
            </div>
          )}

          {fichaEmitida && (
            <div className="surface border-ok/40 p-5 text-center">
              <p className="text-sm text-muted-foreground">Ficha del cliente</p>
              <p className="font-display mt-1 text-5xl text-cacao">
                {fichaEmitida}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Cuando esté listo, lleva el pedido a quien tenga esta ficha.
              </p>
            </div>
          )}
        </section>
      )}

      {tab === "cola" && (
        <section className="space-y-3">
          <div className="surface space-y-2 p-4">
            <label className="label">Entregar por ficha</label>
            <div className="flex gap-2">
              <input
                className="field"
                value={fichaBuscar}
                onChange={(e) => setFichaBuscar(e.target.value.toUpperCase())}
                placeholder="F-001"
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !fichaBuscar}
                onClick={entregar}
              >
                Entregar
              </button>
            </div>
          </div>
          {cola.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos de mostrador activos.</p>
          ) : (
            <ul className="space-y-2">
              {cola.map((c) => (
                <li key={c.id} className="surface p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-display text-2xl">{c.fichaCodigo}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.codigo} · {c.clienteNombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.lineas
                          .map((l) => `${l.cantidad}× ${l.productoNombre}`)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm capitalize">
                        {c.estado.replace("_", " ")}
                      </p>
                      <p className="font-semibold">{formatoMoneda(c.total)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "vitrina" && (
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Stock de producto terminado (distinto de insumos)
          </p>
          <ul className="space-y-2">
            {vitrina.map((v) => (
              <li
                key={v.productoId}
                className="surface flex items-center justify-between gap-2 p-3"
              >
                <div>
                  <p className="font-medium">{v.nombre}</p>
                  <p className="text-xs text-muted-foreground">{formatoMoneda(v.precio)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{v.cantidad} u</span>
                  <button
                    type="button"
                    className="btn btn-secondary py-1 text-sm"
                    disabled={busy}
                    onClick={() =>
                      post({
                        accion: "vitrina",
                        productoId: v.productoId,
                        cantidad: 1,
                        tipo: "entrada",
                        motivo: "Ajuste manual",
                      })
                    }
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost py-1 text-sm"
                    disabled={busy || v.cantidad < 1}
                    onClick={() =>
                      post({
                        accion: "vitrina",
                        productoId: v.productoId,
                        cantidad: 1,
                        tipo: "merma",
                        motivo: "Merma vitrina",
                      })
                    }
                  >
                    Merma
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
