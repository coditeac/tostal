"use client";

import { apiFetch } from "@/lib/api";

import { useEffect, useState } from "react";
import { formatoMoneda } from "@/lib/format";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: boolean;
  alergenos: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  costoTeorico: number;
  margenPct: number;
  duraciones?: Array<{ id: string; etiqueta: string }> | null;
  receta: Array<{
    id: string;
    insumoId: string;
    cantidad: number;
    insumoNombre?: string;
    unidad?: string;
  }>;
};

type Insumo = { id: string; nombre: string; unidad: string };
type Categoria = { id: string; nombre: string };

export default function ProductosPage() {
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
  });
  const [recetaDraft, setRecetaDraft] = useState<
    Array<{ insumoId: string; cantidad: string }>
  >([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pRes, iRes] = await Promise.all([
        apiFetch("/api/productos"),
        apiFetch("/api/insumos"),
      ]);
      const pData = await pRes.json();
      const iData = await iRes.json();
      if (!pRes.ok) throw new Error(pData.error || "Error al cargar");
      setProductos(pData.productos || []);
      setCategorias(pData.categorias || []);
      setInsumos(iData.insumos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditId("nuevo");
    setForm({
      nombre: "",
      descripcion: "",
      precioPesos: "",
      categoriaId: categorias[0]?.id || "",
      alergenos: "",
      activoCatalogo: true,
      duracionesTexto: "",
    });
    setRecetaDraft([{ insumoId: insumos[0]?.id || "", cantidad: "" }]);
  }

  function startEdit(p: Producto) {
    setEditId(p.id);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precioPesos: String(p.precio / 100),
      categoriaId: p.categoriaId || "",
      alergenos: p.alergenos || "",
      activoCatalogo: p.activoCatalogo,
      duracionesTexto: (p.duraciones || []).map((d: { etiqueta: string }) => d.etiqueta).join(", "),
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
      const payload = {
        id: editId === "nuevo" ? undefined : editId,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        precioPesos: Number(form.precioPesos),
        categoriaId: form.categoriaId || null,
        alergenos: form.alergenos || null,
        activoCatalogo: form.activoCatalogo,
        duracionesTexto: form.duracionesTexto,
        receta: recetaDraft
          .filter((r) => r.insumoId && Number(r.cantidad) > 0)
          .map((r) => ({
            insumoId: r.insumoId,
            cantidad: Number(r.cantidad),
          })),
      };
      const res = await apiFetch("/api/productos", {
        method: editId === "nuevo" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="loading-pulse text-muted-foreground">Cargando menú…</p>;
  }

  return (
    <div className="space-y-4 rise-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Menú</h1>
          <p className="text-sm text-muted-foreground">Productos, precios y recetas</p>
        </div>
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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label mb-0">Receta (insumos)</p>
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
            <div className="space-y-2">
              {recetaDraft.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_90px] gap-2">
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
                    placeholder="Cant."
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
              onClick={() => setEditId(null)}
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
            <li key={p.id} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.categoriaNombre || "Sin categoría"}
                    {!p.activoCatalogo ? " · oculto" : ""}
                  </p>
                  {p.descripcion && (
                    <p className="mt-1 text-sm text-muted-foreground">{p.descripcion}</p>
                  )}
                </div>
                <p className="font-semibold">{formatoMoneda(p.precio)}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Costo teórico {formatoMoneda(p.costoTeorico)} · margen{" "}
                {p.margenPct}%
              </p>
              {p.receta.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Receta:{" "}
                  {p.receta
                    .map(
                      (r) =>
                        `${r.insumoNombre} ${r.cantidad}${r.unidad || ""}`
                    )
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
