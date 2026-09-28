"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { formatoMoneda } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  proveedorPreferido: string | null;
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
  motivo: string;
  costoUnitario: number;
};

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
 * Compras: tienda actual → recomendaciones → autocomplete o insumo nuevo → gasto.
 */
export default function ComprasPage() {
  const [tienda, setTienda] = useState("");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [sugerencia, setSugerencia] = useState<Sugerido[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [query, setQuery] = useState("");
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, iRes] = await Promise.all([
        apiFetch("/api/compras"),
        apiFetch("/api/insumos"),
      ]);
      const cData = await cRes.json();
      const iData = await iRes.json();
      if (!cRes.ok) throw new Error(cData.error || "Error al cargar compras");
      if (!iRes.ok) throw new Error(iData.error || "Error al cargar insumos");
      setSugerencia(cData.sugerencia || []);
      setInsumos(iData.insumos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const tiendaNorm = tienda.trim().toLowerCase();

  const recomendados = useMemo(() => {
    if (!tiendaNorm) return sugerencia;
    return sugerencia.filter(
      (s) =>
        !s.proveedor ||
        s.proveedor.toLowerCase().includes(tiendaNorm) ||
        tiendaNorm.includes(s.proveedor.toLowerCase())
    );
  }, [sugerencia, tiendaNorm]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    const ya = new Set(lineas.map((l) => l.insumoId).filter(Boolean));
    return insumos
      .filter(
        (i) =>
          !ya.has(i.id) &&
          i.nombre.toLowerCase().includes(q) &&
          (!tiendaNorm ||
            !i.proveedorPreferido ||
            i.proveedorPreferido.toLowerCase().includes(tiendaNorm) ||
            tiendaNorm.includes(i.proveedorPreferido.toLowerCase()))
      )
      .slice(0, 8);
  }, [query, insumos, lineas, tiendaNorm]);

  function addInsumo(i: Insumo, cantidad?: number) {
    setLineas((prev) => [
      ...prev,
      {
        key: `i-${i.id}-${Date.now()}`,
        insumoId: i.id,
        nombre: i.nombre,
        unidad: i.unidad,
        cantidad: String(cantidad ?? Math.max(1, i.stockMinimo - i.stockActual)),
        costoPesos: String(i.costoUnitario / 100),
        esNuevo: false,
      },
    ]);
    setQuery("");
  }

  function addDesdeSugerencia(s: Sugerido) {
    if (lineas.some((l) => l.insumoId === s.insumoId)) return;
    const found = insumos.find((i) => i.id === s.insumoId);
    if (found) addInsumo(found, s.cantidadSugerida);
  }

  async function crearInsumoYAgregar() {
    if (!nuevo.nombre.trim() || !nuevo.cantidad || !nuevo.costoPesos) {
      setError("Nombre, cantidad y costo son obligatorios para un insumo nuevo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/insumos", {
        method: "POST",
        body: JSON.stringify({
          nombre: nuevo.nombre.trim(),
          unidad: nuevo.unidad,
          stockActual: 0,
          stockMinimo: Number(nuevo.stockMinimo || 0),
          costoPesos: Number(nuevo.costoPesos),
          proveedorPreferido: tienda.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el insumo");
      const insumo = data.insumo as Insumo;
      setInsumos((prev) => [...prev, insumo]);
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
    if (!tienda.trim()) {
      setError("Indica en qué tienda estás.");
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
      const cartRes = await apiFetch("/api/compras", {
        method: "POST",
        body: JSON.stringify({
          accion: "crear_carrito",
          proveedor: tienda.trim(),
          lineas: validas.map((l) => ({
            insumoId: l.insumoId,
            cantidad: Number(l.cantidad),
            costoUnitario: Math.round(Number(l.costoPesos) * 100),
            costoPesos: Number(l.costoPesos),
          })),
        }),
      });
      const cartData = await cartRes.json();
      if (!cartRes.ok) {
        throw new Error(cartData.error || "No se pudo crear la compra");
      }
      const carritoId = cartData.carrito?.id;
      if (!carritoId) throw new Error("Respuesta de carrito sin id");

      const markRes = await apiFetch("/api/compras", {
        method: "POST",
        body: JSON.stringify({
          accion: "marcar_comprada",
          carritoId,
          registrarGasto: true,
        }),
      });
      const markData = await markRes.json();
      if (!markRes.ok) {
        throw new Error(markData.error || "No se pudo registrar la compra");
      }

      setLineas([]);
      setOkMsg(
        `Compra en ${tienda.trim()} registrada · stock actualizado · gasto en Finanzas`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="loading-pulse text-muted-foreground">Cargando compras…</p>
    );
  }

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indica la tienda, revisa recomendaciones y confirma — se registra el
          gasto
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--tostal-ok)_12%,white)] px-3 py-2 text-sm text-ok">
          {okMsg}
        </p>
      )}

      <section className="space-y-2 border-b border-border pb-5">
        <label className="label" htmlFor="tienda">
          ¿En qué tienda estás?
        </label>
        <input
          id="tienda"
          className="field"
          placeholder="Ej. Costco, Central de Abastos, Mercado…"
          value={tienda}
          onChange={(e) => setTienda(e.target.value)}
          list="tiendas-conocidas"
        />
        <datalist id="tiendas-conocidas">
          {Array.from(
            new Set(
              [
                ...insumos.map((i) => i.proveedorPreferido).filter(Boolean),
                ...sugerencia.map((s) => s.proveedor).filter(Boolean),
              ] as string[]
            )
          ).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recomendaciones aquí</h2>
        {!tienda.trim() ? (
          <p className="text-sm text-muted-foreground">
            Escribe la tienda para filtrar qué conviene comprar ahí.
          </p>
        ) : recomendados.length === 0 ? (
          <p className="empty-state">
            Sin recomendaciones para esta tienda. Puedes buscar insumos abajo.
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
                      {s.stockActual} · {s.motivo.replace("_", " ")}
                      {s.proveedor ? ` · ${s.proveedor}` : ""}
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
        <input
          className="field"
          placeholder="Buscar insumo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {matches.length > 0 && (
          <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {matches.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm hover:bg-secondary"
                  onClick={() => addInsumo(i)}
                >
                  <span>
                    {i.nombre}{" "}
                    <span className="text-muted-foreground">({i.unidad})</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {i.stockActual} en stock
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="text-sm font-semibold text-miel"
          onClick={() => setNuevoOpen((v) => !v)}
        >
          {nuevoOpen ? "Cancelar insumo nuevo" : "+ Insumo nuevo"}
        </button>
        {nuevoOpen && (
          <div className="space-y-3 border-y border-border py-4">
            <div>
              <label className="label">Nombre</label>
              <input
                className="field"
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Unidad</label>
                <select
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
                <label className="label">Cantidad</label>
                <input
                  className="field"
                  type="number"
                  value={nuevo.cantidad}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, cantidad: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Costo / u (MXN)</label>
                <input
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
                  <label className="label">Cant.</label>
                  <input
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
                  <label className="label">$/u</label>
                  <input
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
                  className="pb-2 text-xs text-muted-foreground"
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
          disabled={busy || lineas.length === 0}
          onClick={() => void confirmarCompra()}
        >
          {busy ? "Registrando…" : "Confirmar compra y registrar gasto"}
        </Button>
      </section>
    </div>
  );
}
