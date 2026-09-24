"use client";

import { useEffect, useState } from "react";
import { formatoMoneda } from "@/lib/format";

type Insumo = {
  id: string;
  nombre: string;
  unidad: "g" | "ml" | "u";
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  ubicacion: string | null;
  proveedorPreferido: string | null;
  bajoMinimo?: boolean;
};

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    unidad: "g" as Insumo["unidad"],
    stockActual: "",
    stockMinimo: "",
    costoPesos: "",
    ubicacion: "despensa",
    proveedorPreferido: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insumos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setInsumos(data.insumos || []);
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
      unidad: "g",
      stockActual: "0",
      stockMinimo: "0",
      costoPesos: "",
      ubicacion: "despensa",
      proveedorPreferido: "",
    });
  }

  function startEdit(i: Insumo) {
    setEditId(i.id);
    setForm({
      nombre: i.nombre,
      unidad: i.unidad,
      stockActual: String(i.stockActual),
      stockMinimo: String(i.stockMinimo),
      costoPesos: String(i.costoUnitario / 100),
      ubicacion: i.ubicacion || "despensa",
      proveedorPreferido: i.proveedorPreferido || "",
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: editId === "nuevo" ? undefined : editId,
        nombre: form.nombre,
        unidad: form.unidad,
        stockActual: Number(form.stockActual),
        stockMinimo: Number(form.stockMinimo),
        costoPesos: Number(form.costoPesos),
        ubicacion: form.ubicacion || null,
        proveedorPreferido: form.proveedorPreferido || null,
      };
      const res = await fetch("/api/insumos", {
        method: editId === "nuevo" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading-pulse text-muted-foreground">Cargando insumos…</p>;

  return (
    <div className="space-y-4 rise-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Insumos</h1>
          <p className="text-sm text-muted-foreground">Un solo punto de almacén</p>
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
            {editId === "nuevo" ? "Nuevo insumo" : "Editar insumo"}
          </h2>
          <div>
            <label className="label">Nombre</label>
            <input
              className="field"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Unidad</label>
              <select
                className="field"
                value={form.unidad}
                onChange={(e) =>
                  setForm({
                    ...form,
                    unidad: e.target.value as Insumo["unidad"],
                  })
                }
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="u">u</option>
              </select>
            </div>
            <div>
              <label className="label">Stock</label>
              <input
                className="field"
                type="number"
                value={form.stockActual}
                onChange={(e) =>
                  setForm({ ...form, stockActual: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Mínimo</label>
              <input
                className="field"
                type="number"
                value={form.stockMinimo}
                onChange={(e) =>
                  setForm({ ...form, stockMinimo: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Costo unitario (MXN)</label>
              <input
                className="field"
                type="number"
                step="0.001"
                value={form.costoPesos}
                onChange={(e) =>
                  setForm({ ...form, costoPesos: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Ubicación</label>
              <select
                className="field"
                value={form.ubicacion}
                onChange={(e) =>
                  setForm({ ...form, ubicacion: e.target.value })
                }
              >
                <option value="despensa">Despensa</option>
                <option value="frío">Frío</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Proveedor preferido</label>
            <input
              className="field"
              value={form.proveedorPreferido}
              onChange={(e) =>
                setForm({ ...form, proveedorPreferido: e.target.value })
              }
            />
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

      {insumos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay insumos todavía.</p>
      ) : (
        <ul className="space-y-2">
          {insumos.map((i) => (
            <li key={i.id} className="surface flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">
                  {i.nombre}
                  {i.bajoMinimo && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-alerta">
                      Bajo
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {i.stockActual} {i.unidad} · mín {i.stockMinimo} ·{" "}
                  {i.ubicacion || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Costo {formatoMoneda(i.costoUnitario)} / {i.unidad}
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-miel-dark"
                onClick={() => startEdit(i)}
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
