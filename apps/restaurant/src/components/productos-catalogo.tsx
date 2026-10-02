"use client";

import { listInsumos } from "@/lib/data/insumos";
import {
  listProductosConReceta,
  upsertProducto,
} from "@/lib/data/productos";
import {
  FOTO_ACCEPT,
  fotoUrlFromProducto,
  removeProductoFoto,
  uploadProductoFoto,
  validateFotoFile,
} from "@/lib/producto-foto";
import { useEffect, useRef, useState } from "react";
import { formatoMoneda } from "@/lib/format";
import { Switch } from "@/components/ui/switch";

type LineaRecetaUi = {
  id: string;
  insumoId: string;
  /** Cantidad del lote completo (no por pieza). */
  cantidad: number;
  /** API: cantidad_lote / receta_rendimiento. */
  porPieza?: number;
  insumoNombre?: string;
  unidad?: string;
};

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: boolean;
  alergenos: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  /** URL pública de la foto (API: foto_url / imagen_url). */
  fotoUrl: string | null;
  /** Costo auto por pieza desde receta (API: costo_calculado). */
  costoCalculado: number;
  margenPct: number;
  /** Piezas que produce el lote de la receta (default 1). */
  recetaRendimiento: number;
  reservaHabilitada?: boolean;
  anticipoTipo?: "porcentaje" | "monto" | null;
  anticipoValor?: number | null;
  /** Anticipación mínima en días (CDMX): fecha ≥ hoy + N. */
  reservaDiasMinimos?: number;
  /** Cantidad mínima por línea/pedido de reserva. */
  reservaCantidadMinima?: number;
  duraciones?: Array<{ id: string; etiqueta: string }> | null;
  receta: LineaRecetaUi[];
};

type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
  costoUnitario?: number;
};
type Categoria = { id: string; nombre: string };

function formatCantidad(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function ProductosCatalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    precioPesos: "",
    categoriaId: "",
    alergenos: "",
    activoCatalogo: true,
    duracionesTexto: "",
    /** Cuántas piezas produce el lote de esta receta. */
    recetaRendimiento: "1",
    reservaHabilitada: false,
    anticipoTipo: "porcentaje" as "porcentaje" | "monto",
    anticipoValor: "",
    reservaDiasMinimos: "3",
    reservaCantidadMinima: "1",
  });
  const [recetaDraft, setRecetaDraft] = useState<
    Array<{ insumoId: string; cantidad: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  /** Preview local (object URL) o URL remota al editar. */
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoRemota, setFotoRemota] = useState<string | null>(null);
  const [fotoPendiente, setFotoPendiente] = useState<File | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const rendimientoDraft = Math.max(
    1,
    Math.floor(Number(form.recetaRendimiento) || 1)
  );

  const insumosById = Object.fromEntries(insumos.map((i) => [i.id, i]));

  /** Preview en vivo: por pieza = cantidad_lote / rendimiento. */
  const previewLineas = recetaDraft
    .filter((r) => r.insumoId && Number(r.cantidad) > 0)
    .map((r) => {
      const insumo = insumosById[r.insumoId];
      const cantidadLote = Number(r.cantidad);
      const porPieza = cantidadLote / rendimientoDraft;
      const costoUnit = Number(insumo?.costoUnitario ?? 0);
      return {
        insumoId: r.insumoId,
        nombre: insumo?.nombre || "Insumo",
        unidad: insumo?.unidad || "",
        cantidadLote,
        porPieza,
        costoPieza: porPieza * costoUnit,
      };
    });

  const previewCostoPieza = previewLineas.reduce(
    (sum, l) => sum + l.costoPieza,
    0
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [list, iRows] = await Promise.all([
        listProductosConReceta(),
        listInsumos(),
      ]);
      setProductos(list as unknown as Producto[]);
      setCategorias([]);
      setInsumos(
        iRows.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          unidad: i.unidad,
          costoUnitario: Number(i.costo_unitario) || 0,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function clearFotoLocalPreview() {
    setFotoPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setFotoPendiente(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  function resetFotoEditor(remote: string | null = null) {
    clearFotoLocalPreview();
    setFotoRemota(remote);
    setFotoPreview(remote);
  }

  function onPickFoto(file: File | null) {
    if (!file) return;
    const err = validateFotoFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFotoPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFotoPendiente(file);
  }

  async function applyFotoUpload(productoId: string, file: File) {
    setFotoBusy(true);
    try {
      const { fotoUrl } = await uploadProductoFoto(productoId, file);
      setFotoPendiente(null);
      setFotoRemota(fotoUrl);
      setFotoPreview(fotoUrl);
      setProductos((prev) =>
        prev.map((p) => (p.id === productoId ? { ...p, fotoUrl } : p))
      );
    } finally {
      setFotoBusy(false);
    }
  }

  async function applyFotoRemove(productoId: string) {
    setFotoBusy(true);
    try {
      await removeProductoFoto(productoId);
      resetFotoEditor(null);
      setProductos((prev) =>
        prev.map((p) => (p.id === productoId ? { ...p, fotoUrl: null } : p))
      );
    } finally {
      setFotoBusy(false);
    }
  }

  function startNew() {
    setEditId("nuevo");
    resetFotoEditor(null);
    setForm({
      nombre: "",
      descripcion: "",
      precioPesos: "",
      categoriaId: categorias[0]?.id || "",
      alergenos: "",
      activoCatalogo: true,
      duracionesTexto: "",
      recetaRendimiento: "1",
      reservaHabilitada: false,
      anticipoTipo: "porcentaje",
      anticipoValor: "30",
      reservaDiasMinimos: "3",
      reservaCantidadMinima: "1",
    });
    setRecetaDraft([{ insumoId: insumos[0]?.id || "", cantidad: "" }]);
  }

  function startEdit(p: Producto) {
    setEditId(p.id);
    resetFotoEditor(p.fotoUrl);
    const anticipoEsMonto = p.anticipoTipo === "monto";
    const anticipoMostrar =
      p.anticipoValor == null
        ? ""
        : anticipoEsMonto
          ? String(p.anticipoValor / 100)
          : String(p.anticipoValor);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precioPesos: String(p.precio / 100),
      categoriaId: p.categoriaId || "",
      alergenos: p.alergenos || "",
      activoCatalogo: p.activoCatalogo,
      duracionesTexto: (p.duraciones || []).map((d: { etiqueta: string }) => d.etiqueta).join(", "),
      recetaRendimiento: String(
        p.recetaRendimiento != null && p.recetaRendimiento >= 1
          ? p.recetaRendimiento
          : 1
      ),
      reservaHabilitada: Boolean(p.reservaHabilitada),
      anticipoTipo: p.anticipoTipo === "monto" ? "monto" : "porcentaje",
      anticipoValor: anticipoMostrar || (p.reservaHabilitada ? "30" : ""),
      reservaDiasMinimos: String(
        p.reservaDiasMinimos != null && p.reservaDiasMinimos >= 0
          ? p.reservaDiasMinimos
          : 3
      ),
      reservaCantidadMinima: String(
        p.reservaCantidadMinima != null && p.reservaCantidadMinima >= 1
          ? p.reservaCantidadMinima
          : 1
      ),
    });
    setRecetaDraft(
      p.receta.length
        ? p.receta.map((r) => ({
            insumoId: r.insumoId,
            cantidad: String(r.cantidad),
          }))
        : [{ insumoId: insumos[0]?.id || "", cantidad: "" }]
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const anticipoValorNum = Number(form.anticipoValor || 0);
      const anticipoValorPayload =
        form.anticipoTipo === "monto"
          ? Math.round(anticipoValorNum * 100)
          : anticipoValorNum;
      const diasMin = Math.max(0, Math.floor(Number(form.reservaDiasMinimos) || 0));
      const cantMin = Math.max(1, Math.floor(Number(form.reservaCantidadMinima) || 1));
      const rendimiento = Math.max(
        1,
        Math.floor(Number(form.recetaRendimiento) || 1)
      );

      const precioCentavos = Math.round(Number(form.precioPesos) * 100);
      const savedId = await upsertProducto({
        id: editId === "nuevo" ? undefined : editId || undefined,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        precio_venta: precioCentavos,
        activo: form.activoCatalogo,
        reserva_habilitada: form.reservaHabilitada,
        anticipo_tipo: form.reservaHabilitada ? form.anticipoTipo : "porcentaje",
        anticipo_valor: form.reservaHabilitada ? anticipoValorPayload : 0,
        reserva_dias_minimos: diasMin,
        reserva_cantidad_minima: cantMin,
        receta_rendimiento: rendimiento,
        receta: recetaDraft
          .filter((r) => r.insumoId && Number(r.cantidad) > 0)
          .map((r) => ({
            insumoId: r.insumoId,
            cantidad: Number(r.cantidad),
          })),
      });
      if (!savedId) throw new Error("Producto guardado sin id.");

      if (fotoPendiente) {
        await applyFotoUpload(savedId, fotoPendiente);
      }

      setEditId(null);
      resetFotoEditor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="loading-pulse text-muted-foreground">Cargando productos…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Foto, receta por lote, costo por pieza y precio de venta
        </p>
        <button type="button" className="btn btn-primary" onClick={startNew}>
          Nuevo
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {editId && (
        <section className="surface space-y-3 p-4">
          <h2 className="font-semibold">
            {editId === "nuevo" ? "Nuevo producto" : "Editar producto"}
          </h2>
          <div>
            <label className="label">Nombre</label>
            <input
              className="field"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea
              className="field min-h-20"
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
            />
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="label mb-0">Foto del producto</p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG o WebP · máx. 5 MB. Se sube al guardar
              {editId !== "nuevo" ? " o al cambiar." : "."}
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <div className="relative h-24 w-24 overflow-hidden rounded-xl bg-muted">
                {fotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoPreview}
                    alt="Vista previa"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                    Sin foto
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept={FOTO_ACCEPT}
                  className="sr-only"
                  aria-label="Elegir foto del producto"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    onPickFoto(file);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saving || fotoBusy}
                    onClick={() => fotoInputRef.current?.click()}
                  >
                    {fotoPreview || fotoRemota ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {editId !== "nuevo" && fotoPendiente && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving || fotoBusy}
                      onClick={async () => {
                        setError(null);
                        try {
                          await applyFotoUpload(editId, fotoPendiente);
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "No se pudo subir la foto"
                          );
                        }
                      }}
                    >
                      {fotoBusy ? "Subiendo…" : "Subir ahora"}
                    </button>
                  )}
                  {(fotoPreview || fotoRemota) && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={saving || fotoBusy}
                      onClick={async () => {
                        setError(null);
                        if (editId === "nuevo" || (!fotoRemota && fotoPendiente)) {
                          clearFotoLocalPreview();
                          setFotoPreview(null);
                          return;
                        }
                        if (fotoPendiente && fotoRemota) {
                          clearFotoLocalPreview();
                          setFotoPreview(fotoRemota);
                          return;
                        }
                        try {
                          await applyFotoRemove(editId!);
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "No se pudo quitar la foto"
                          );
                        }
                      }}
                    >
                      {fotoBusy ? "…" : "Quitar"}
                    </button>
                  )}
                </div>
                {fotoPendiente && (
                  <p className="text-xs text-muted-foreground">
                    Pendiente: {fotoPendiente.name}
                    {editId === "nuevo"
                      ? " (se sube al guardar el producto)"
                      : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Precio (MXN)</label>
              <input
                className="field"
                type="number"
                step="0.01"
                value={form.precioPesos}
                onChange={(e) =>
                  setForm({ ...form, precioPesos: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select
                className="field"
                value={form.categoriaId}
                onChange={(e) =>
                  setForm({ ...form, categoriaId: e.target.value })
                }
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Alérgenos</label>
            <input
              className="field"
              value={form.alergenos}
              onChange={(e) => setForm({ ...form, alergenos: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Duraciones (admin Tostal, no Stripe)</label>
            <input
              className="field"
              placeholder="mismo día, 2 días, fin de semana…"
              value={form.duracionesTexto}
              onChange={(e) =>
                setForm({ ...form, duracionesTexto: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Separadas por coma. Precio y duraciones viven en Postgres vía API.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.activoCatalogo}
              onChange={(e) =>
                setForm({ ...form, activoCatalogo: e.target.checked })
              }
            />
            Activo en catálogo
          </label>

          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Reserva / bajo pedido</p>
                <p className="text-xs text-muted-foreground">
                  El cliente elige fecha y paga anticipo
                </p>
              </div>
              <Switch
                checked={form.reservaHabilitada}
                onCheckedChange={(checked) =>
                  setForm({
                    ...form,
                    reservaHabilitada: checked,
                    anticipoValor:
                      checked && !form.anticipoValor ? "30" : form.anticipoValor,
                    reservaDiasMinimos:
                      checked && !form.reservaDiasMinimos
                        ? "3"
                        : form.reservaDiasMinimos,
                    reservaCantidadMinima:
                      checked && !form.reservaCantidadMinima
                        ? "1"
                        : form.reservaCantidadMinima,
                  })
                }
                aria-label="Habilitar reserva"
              />
            </div>
            {form.reservaHabilitada && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo de anticipo</label>
                  <select
                    className="field"
                    value={form.anticipoTipo}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        anticipoTipo: e.target.value as "porcentaje" | "monto",
                      })
                    }
                  >
                    <option value="porcentaje">Porcentaje %</option>
                    <option value="monto">Monto fijo (MXN)</option>
                  </select>
                </div>
                <div>
                  <label className="label">
                    {form.anticipoTipo === "monto" ? "Anticipo MXN" : "Anticipo %"}
                  </label>
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step={form.anticipoTipo === "monto" ? "0.01" : "1"}
                    value={form.anticipoValor}
                    onChange={(e) =>
                      setForm({ ...form, anticipoValor: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            {form.reservaHabilitada && (
              <div>
                <label className="label">Días mínimos de anticipación</label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {[3, 5].map((n) => {
                    const activo = Number(form.reservaDiasMinimos) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={
                          activo
                            ? "rounded-lg bg-miel px-3 py-1.5 text-sm font-medium text-primary-foreground"
                            : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground"
                        }
                        onClick={() =>
                          setForm({ ...form, reservaDiasMinimos: String(n) })
                        }
                      >
                        {n} días
                      </button>
                    );
                  })}
                </div>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={form.reservaDiasMinimos}
                  onChange={(e) =>
                    setForm({ ...form, reservaDiasMinimos: e.target.value })
                  }
                  aria-label="Días mínimos de anticipación"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  La fecha de reserva debe ser al menos hoy (CDMX) + estos días.
                </p>
              </div>
            )}
            {form.reservaHabilitada && (
              <div>
                <label className="label">Cantidad mínima</label>
                <input
                  className="field"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.reservaCantidadMinima}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reservaCantidadMinima: e.target.value,
                    })
                  }
                  aria-label="Cantidad mínima de reserva"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Mínimo por línea o pedido de reserva (entero ≥ 1).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="label mb-0">Receta</p>
                <p className="text-xs text-muted-foreground">
                  Cantidades del lote completo; el costo por pieza se calcula solo
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-miel-dark"
                onClick={() =>
                  setRecetaDraft([
                    ...recetaDraft,
                    { insumoId: insumos[0]?.id || "", cantidad: "" },
                  ])
                }
              >
                + línea
              </button>
            </div>
            <div>
              <label className="label">Esta receta rinde N piezas</label>
              <input
                className="field"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={form.recetaRendimiento}
                onChange={(e) =>
                  setForm({ ...form, recetaRendimiento: e.target.value })
                }
                aria-label="Esta receta rinde N piezas"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ej. 9 roles con 2 huevos en el lote → ≈ {formatCantidad(2 / Math.max(1, rendimientoDraft))} huevos por pieza.
              </p>
            </div>
            <div className="space-y-2">
              {recetaDraft.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_110px] gap-2">
                  <select
                    className="field"
                    value={r.insumoId}
                    onChange={(e) => {
                      const next = [...recetaDraft];
                      next[idx] = { ...r, insumoId: e.target.value };
                      setRecetaDraft(next);
                    }}
                  >
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre} ({i.unidad})
                      </option>
                    ))}
                  </select>
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Cant. lote"
                    aria-label="Cantidad del lote"
                    value={r.cantidad}
                    onChange={(e) => {
                      const next = [...recetaDraft];
                      next[idx] = { ...r, cantidad: e.target.value };
                      setRecetaDraft(next);
                    }}
                  />
                </div>
              ))}
            </div>
            {previewLineas.length > 0 && (
              <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Por pieza (API · rinde {rendimientoDraft})
                </p>
                <ul className="mt-1 space-y-0.5">
                  {previewLineas.map((l) => (
                    <li key={l.insumoId}>
                      ≈ {formatCantidad(l.porPieza)} {l.unidad} {l.nombre}
                      {l.costoPieza > 0
                        ? ` · ${formatoMoneda(l.costoPieza)}`
                        : ""}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-medium text-foreground">
                  Costo calculado / pieza ≈ {formatoMoneda(previewCostoPieza)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Preview local = lote ÷ rendimiento (igual que{" "}
                  <code className="text-[10px]">por_pieza</code> /{" "}
                  <code className="text-[10px]">costo_calculado</code> al
                  guardar).
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEditId(null);
                resetFotoEditor(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      {productos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay productos. Crea el primero para armar el menú.
        </p>
      ) : (
        <ul className="space-y-3">
          {productos.map((p) => (
            <li key={p.id} className="border-b border-border py-4 first:border-t">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {p.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.fotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.categoriaNombre || "Sin categoría"}
                      {!p.activoCatalogo ? " · oculto" : ""}
                      {p.reservaHabilitada ? " · reserva" : ""}
                    </p>
                    {p.descripcion && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.descripcion}
                      </p>
                    )}
                  </div>
                </div>
                <p className="font-semibold">{formatoMoneda(p.precio)}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Costo calculado {formatoMoneda(p.costoCalculado)} · margen{" "}
                {p.margenPct}%
                {p.recetaRendimiento > 1
                  ? ` · rinde ${p.recetaRendimiento}`
                  : ""}
                {p.reservaHabilitada
                  ? ` · anticipo ${
                      p.anticipoTipo === "monto"
                        ? formatoMoneda(p.anticipoValor || 0)
                        : `${p.anticipoValor ?? 0}%`
                    } · min ${p.reservaDiasMinimos ?? 3}d / qty ${p.reservaCantidadMinima ?? 1}`
                  : ""}
              </p>
              {p.receta.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Receta (lote → {p.recetaRendimiento} pza
                  {p.recetaRendimiento === 1 ? "" : "s"}):{" "}
                  {p.receta
                    .map((r) => {
                      const por =
                        r.porPieza != null
                          ? r.porPieza
                          : r.cantidad / Math.max(1, p.recetaRendimiento);
                      return `${r.insumoNombre} ${formatCantidad(r.cantidad)}${r.unidad || ""} lote · ${formatCantidad(por)}${r.unidad || ""}/pza`;
                    })
                    .join(" · ")}
                </p>
              )}
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-miel-dark"
                onClick={() => startEdit(p)}
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
