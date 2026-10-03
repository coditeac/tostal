"use client";

import Link from "next/link";
import {
  altaInsumoCompra,
  anularCompra,
  cerrarCompra,
  listComprasRecientes,
  loadComprasSugerencia,
  type CompraReciente,
} from "@/lib/data/compras";
import { listInsumos, mapInsumoUi } from "@/lib/data/insumos";
import { useEffect, useMemo, useState } from "react";
import { formatoMoneda } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  proveedorPreferido?: string | null;
  proveedorPreferidoId?: string | null;
  bajoMinimo?: boolean;
};

type Sugerido = {
  insumoId: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  cantidadSugerida: number;
  proveedor: string | null;
  proveedorId?: string | null;
  motivo: string;
  costoUnitario: number;
  paraTienda?: boolean;
};

type Tienda = { id: string; nombre: string; preferido?: boolean };

type Linea = {
  key: string;
  insumoId: string | null;
  nombre: string;
  unidad: string;
  cantidad: string;
  costoPesos: string;
  esNuevo: boolean;
};

/**
 * Compras: tienda → recomendaciones → autocomplete / alta → cerrar_compra → gasto.
 */
export default function ComprasPage() {
  const [tiendaId, setTiendaId] = useState("");
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [sugerencia, setSugerencia] = useState<Sugerido[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Insumo[]>([]);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    unidad: "g",
    cantidad: "",
    costoPesos: "",
    stockMinimo: "0",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<CompraReciente[]>([]);
  const [anularTarget, setAnularTarget] = useState<CompraReciente | null>(null);
  const [anulando, setAnulando] = useState(false);

  const tiendaNombre =
    tiendas.find((t) => t.id === tiendaId)?.nombre?.trim() || "";

  async function load(tiendaCtx?: string) {
    setLoading(true);
    setError(null);
    try {
      const [data, hist] = await Promise.all([
        loadComprasSugerencia(tiendaCtx),
        listComprasRecientes(15),
      ]);
      setSugerencia(data.sugerencia || []);
      const list = (data.tiendas || []) as Tienda[];
      setTiendas(list);
      setRecientes(hist);
      setTiendaId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return list[0]?.id || "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await listInsumos({ q, limit: 8 });
        const ya = new Set(lineas.map((l) => l.insumoId).filter(Boolean));
        setMatches(
          rows.map(mapInsumoUi).filter((i) => !ya.has(i.id)) as Insumo[]
        );
      } catch {
        /* ignore */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, lineas]);

  const recomendados = useMemo(() => {
    if (!tiendaId) return sugerencia;
    return sugerencia.filter(
      (s) =>
        s.paraTienda !== false &&
        (!s.proveedorId ||
          s.proveedorId === tiendaId ||
          !s.proveedor ||
          (tiendaNombre &&
            (s.proveedor.toLowerCase().includes(tiendaNombre.toLowerCase()) ||
              tiendaNombre
                .toLowerCase()
                .includes(s.proveedor.toLowerCase()))))
    );
  }, [sugerencia, tiendaId, tiendaNombre]);

  function addInsumo(i: Insumo, cantidad?: number) {
    setLineas((prev) => [
      ...prev,
      {
        key: `i-${i.id}-${Date.now()}`,
        insumoId: i.id,
        nombre: i.nombre,
        unidad: i.unidad,
        cantidad: String(
          cantidad ??
            Math.max(1, (i.stockMinimo || 0) - (i.stockActual || 0) || 1)
        ),
        costoPesos: String((i.costoUnitario || 0) / 100),
        esNuevo: false,
      },
    ]);
    setQuery("");
    setMatches([]);
  }

  function addDesdeSugerencia(s: Sugerido) {
    if (lineas.some((l) => l.insumoId === s.insumoId)) return;
    addInsumo(
      {
        id: s.insumoId,
        nombre: s.nombre,
        unidad: s.unidad,
        stockActual: s.stockActual,
        stockMinimo: s.stockMinimo,
        costoUnitario: s.costoUnitario,
      },
      s.cantidadSugerida
    );
  }

  async function crearInsumoYAgregar() {
    if (!nuevo.nombre.trim() || !nuevo.cantidad || !nuevo.costoPesos) {
      setError("Nombre, cantidad y costo son obligatorios para un insumo nuevo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const insumo = (await altaInsumoCompra({
        nombre: nuevo.nombre.trim(),
        unidad: nuevo.unidad,
        cantidad: Number(nuevo.cantidad),
        costoPesos: Number(nuevo.costoPesos),
        stockMinimo: Number(nuevo.stockMinimo || 0),
        proveedorPreferidoId: tiendaId || null,
      })) as Insumo;
      setLineas((prev) => [
        ...prev,
        {
          key: `n-${insumo.id}`,
          insumoId: insumo.id,
          nombre: insumo.nombre,
          unidad: insumo.unidad,
          cantidad: nuevo.cantidad,
          costoPesos: nuevo.costoPesos,
          esNuevo: true,
        },
      ]);
      setNuevo({
        nombre: "",
        unidad: "g",
        cantidad: "",
        costoPesos: "",
        stockMinimo: "0",
      });
      setNuevoOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const totalEstimado = lineas.reduce((acc, l) => {
    const c = Number(l.cantidad) || 0;
    const p = Number(l.costoPesos) || 0;
    return acc + Math.round(c * p * 100);
  }, 0);

  async function confirmarCompra() {
    if (!tiendaId || !tiendaNombre) {
      setError("Selecciona la tienda de proveedor.");
      return;
    }
    const validas = lineas.filter(
      (l) => l.insumoId && Number(l.cantidad) > 0 && Number(l.costoPesos) >= 0
    );
    if (!validas.length) {
      setError("Agrega al menos una línea con cantidad.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const markData = await cerrarCompra({
        tiendaId,
        tiendaNombre,
        lineas: validas.map((l) => ({
          insumoId: l.insumoId!,
          nombre: l.nombre,
          cantidad: Number(l.cantidad),
          costoPesos: Number(l.costoPesos),
        })),
      });
      const gastoMonto = markData.gasto?.monto;
      setLineas([]);
      setOkMsg(
        gastoMonto != null
          ? `Compra cerrada en ${tiendaNombre} · gasto ${formatoMoneda(gastoMonto)} en Finanzas`
          : `Compra cerrada en ${tiendaNombre} · stock y gasto registrados`
      );
      await load(tiendaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !sugerencia.length && !tiendas.length) {
    return (
      <p className="loading-pulse text-muted-foreground">Cargando compras…</p>
    );
  }

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige tienda, arma la lista y cierra la compra (entra stock y gasto)
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {okMsg && (
        <p
          className="rounded-xl bg-[color-mix(in_srgb,var(--tostal-ok)_12%,white)] px-3 py-2 text-sm text-ok"
          role="status"
        >
          {okMsg}
        </p>
      )}

      <section className="space-y-2 border-b border-border pb-5">
        <label className="label" htmlFor="tienda">
          ¿En qué tienda estás?
        </label>
        {tiendas.length === 0 ? (
          <p className="empty-state" role="status">
            Agrega tiendas en{" "}
            <Link href="/ajustes" className="font-semibold text-miel">
              Configuración
            </Link>
            .
          </p>
        ) : (
          <select
            id="tienda"
            className="field"
            value={tiendaId}
            onChange={(e) => setTiendaId(e.target.value)}
            required
          >
            {tiendas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recomendaciones aquí</h2>
        {!tiendaId ? (
          <p className="text-sm text-muted-foreground">
            Selecciona la tienda para filtrar qué conviene comprar ahí.
          </p>
        ) : recomendados.length === 0 ? (
          <p className="empty-state">
            Sin recomendaciones para esta tienda. Busca insumos abajo.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {recomendados.map((s) => {
              const ya = lineas.some((l) => l.insumoId === s.insumoId);
              return (
                <li
                  key={s.insumoId}
                  className="flex items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Sug. {s.cantidadSugerida} {s.unidad} · stock{" "}
                      {s.stockActual} · {String(s.motivo).replace("_", " ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={ya ? "secondary" : "outline"}
                    disabled={ya}
                    onClick={() => addDesdeSugerencia(s)}
                  >
                    {ya ? "En lista" : "Agregar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Agregar insumo</h2>
        <label className="label" htmlFor="compra-buscar">
          Buscar en catálogo
        </label>
        <input
          id="compra-buscar"
          className="field"
          placeholder="Buscar insumo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={matches.length > 0 ? "compra-matches" : undefined}
        />
        {matches.length > 0 && (
          <ul
            id="compra-matches"
            role="listbox"
            aria-label="Resultados de insumos"
            className="overflow-hidden rounded-xl border border-border divide-y divide-border"
          >
            {matches.map((i) => (
              <li key={i.id} role="option">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => addInsumo(i)}
                >
                  <span>
                    {i.nombre}{" "}
                    <span className="text-muted-foreground">({i.unidad})</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {i.stockActual ?? 0} en stock
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="text-sm font-semibold text-miel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-expanded={nuevoOpen}
          onClick={() => setNuevoOpen((v) => !v)}
        >
          {nuevoOpen ? "Cancelar insumo nuevo" : "+ Insumo nuevo"}
        </button>
        {nuevoOpen && (
          <div className="space-y-3 border-y border-border py-4">
            <div>
              <label className="label" htmlFor="nuevo-nombre">
                Nombre
              </label>
              <input
                id="nuevo-nombre"
                className="field"
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label" htmlFor="nuevo-unidad">
                  Unidad
                </label>
                <select
                  id="nuevo-unidad"
                  className="field"
                  value={nuevo.unidad}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, unidad: e.target.value })
                  }
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="u">u</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="nuevo-cantidad">
                  Cantidad
                </label>
                <input
                  id="nuevo-cantidad"
                  className="field"
                  type="number"
                  value={nuevo.cantidad}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, cantidad: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="nuevo-costo">
                  Costo / u (MXN)
                </label>
                <input
                  id="nuevo-costo"
                  className="field"
                  type="number"
                  step="0.01"
                  value={nuevo.costoPesos}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, costoPesos: e.target.value })
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={busy}
              onClick={() => void crearInsumoYAgregar()}
            >
              {busy ? "Creando…" : "Crear y agregar a la compra"}
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tu compra</h2>
          <p className="text-sm font-semibold tabular-nums">
            {formatoMoneda(totalEstimado)}
          </p>
        </div>
        {lineas.length === 0 ? (
          <p className="empty-state">Aún no hay líneas.</p>
        ) : (
          <ul className="space-y-3">
            {lineas.map((l) => (
              <li
                key={l.key}
                className="grid grid-cols-[1fr_72px_88px_auto] items-end gap-2 border-b border-border pb-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {l.nombre}
                    {l.esNuevo ? " · nuevo" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.unidad}</p>
                </div>
                <div>
                  <label className="label" htmlFor={`linea-cant-${l.key}`}>
                    Cant.
                  </label>
                  <input
                    id={`linea-cant-${l.key}`}
                    className="field"
                    type="number"
                    value={l.cantidad}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((x) =>
                          x.key === l.key
                            ? { ...x, cantidad: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`linea-costo-${l.key}`}>
                    $/u
                  </label>
                  <input
                    id={`linea-costo-${l.key}`}
                    className="field"
                    type="number"
                    step="0.01"
                    value={l.costoPesos}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((x) =>
                          x.key === l.key
                            ? { ...x, costoPesos: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </div>
                <button
                  type="button"
                  className="min-h-[var(--tap)] pb-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  aria-label={`Quitar ${l.nombre} de la compra`}
                  onClick={() =>
                    setLineas((prev) => prev.filter((x) => x.key !== l.key))
                  }
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={busy || lineas.length === 0 || !tiendaId}
          onClick={() => void confirmarCompra()}
        >
          {busy ? "Cerrando…" : "Cerrar compra y registrar gasto"}
        </Button>
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-semibold">Compras recientes</h2>
        {recientes.length === 0 ? (
          <p className="empty-state">Sin compras registradas.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {recientes.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {c.tienda || "Sin tienda"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(c.closed_at || c.created_at || "").slice(0, 10)} ·{" "}
                    {c.estado}
                    {c.total > 0 ? ` · ${formatoMoneda(c.total)}` : ""}
                  </p>
                </div>
                {c.estado !== "anulada" ? (
                  <button
                    type="button"
                    className="min-h-[var(--tap)] shrink-0 text-xs font-semibold text-error"
                    aria-label={`Anular compra en ${c.tienda}`}
                    onClick={() => setAnularTarget(c)}
                  >
                    Anular
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Anulada</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!anularTarget}
        onOpenChange={(open) => {
          if (!open) setAnularTarget(null);
        }}
        title="¿Anular compra?"
        description={
          anularTarget
            ? `La compra en «${anularTarget.tienda}» se marcará como anulada. El stock ya ingresado y el gasto en Finanzas no se revierten automáticamente; puedes eliminar el gasto aparte si aplica.`
            : ""
        }
        confirmLabel="Anular"
        busy={anulando}
        onConfirm={async () => {
          if (!anularTarget) return;
          setAnulando(true);
          setError(null);
          try {
            await anularCompra(anularTarget.id);
            setAnularTarget(null);
            await load(tiendaId || undefined);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error al anular");
          } finally {
            setAnulando(false);
          }
        }}
      />
    </div>
  );
}
