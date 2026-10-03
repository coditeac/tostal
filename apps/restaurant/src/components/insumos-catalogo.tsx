"use client";

import Link from "next/link";
import {
  createInsumo,
  deleteInsumo,
  listInsumos,
  mapInsumoUi,
  updateInsumo,
} from "@/lib/data/insumos";
import {
  listTiendasProveedor,
  type TiendaProveedorRow,
} from "@/lib/data/tiendas-proveedor";

import { useEffect, useState } from "react";
import { formatoMoneda } from "@/lib/format";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Insumo = {
  id: string;
  nombre: string;
  unidad: "g" | "ml" | "u";
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  ubicacion: string | null;
  proveedorPreferido: string | null;
  proveedorPreferidoId: string | null;
  bajoMinimo?: boolean;
};

export function InsumosCatalogo() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [tiendas, setTiendas] = useState<TiendaProveedorRow[]>([]);
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
    proveedorPreferidoId: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Insumo | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rows, shops] = await Promise.all([
        listInsumos(),
        listTiendasProveedor({ soloActivas: true }),
      ]);
      setInsumos(rows.map(mapInsumoUi) as unknown as Insumo[]);
      setTiendas(shops);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
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
      proveedorPreferidoId: "",
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
      proveedorPreferidoId: i.proveedorPreferidoId || "",
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const proveedorId = form.proveedorPreferidoId || null;
      const proveedorNombre =
        tiendas.find((t) => t.id === proveedorId)?.nombre ?? null;
      const body = {
        nombre: form.nombre,
        unidad: form.unidad,
        stock: Number(form.stockActual),
        umbral_pocos: Number(form.stockMinimo),
        costo_unitario: Math.round(Number(form.costoPesos) * 100),
        proveedor_preferido_id: proveedorId,
        proveedor_preferido: proveedorNombre,
      };
      if (editId === "nuevo") await createInsumo(body);
      else if (editId) await updateInsumo(editId, body);
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="loading-pulse text-muted-foreground">Cargando insumos…</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Alta y mínimos — alerta cuando hay pocos
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
            <label className="label" htmlFor="insumo-proveedor">
              Proveedor / tienda preferida
            </label>
            {tiendas.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status">
                Agrega tiendas en{" "}
                <Link href="/ajustes" className="font-semibold text-miel">
                  Configuración
                </Link>
                .
              </p>
            ) : (
              <select
                id="insumo-proveedor"
                className="field"
                value={form.proveedorPreferidoId}
                onChange={(e) =>
                  setForm({ ...form, proveedorPreferidoId: e.target.value })
                }
              >
                <option value="">Sin preferencia</option>
                {tiendas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={saving}
              onClick={() => void save()}
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
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 border-b border-border py-4 first:border-t"
            >
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
                  {i.proveedorPreferido
                    ? ` · ${i.proveedorPreferido}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  className="min-h-[var(--tap)] text-sm font-semibold text-miel-dark"
                  aria-label={`Editar ${i.nombre}`}
                  onClick={() => startEdit(i)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="min-h-[var(--tap)] text-sm font-semibold text-error"
                  aria-label={`Eliminar ${i.nombre}`}
                  onClick={() => setDeleteTarget(i)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="¿Eliminar insumo?"
        description={
          deleteTarget
            ? `«${deleteTarget.nombre}» se eliminará del almacén. Si forma parte de una receta o compra, se archivará (activo=false) para no romper el historial.`
            : ""
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          setError(null);
          try {
            await deleteInsumo(deleteTarget.id);
            setDeleteTarget(null);
            if (editId === deleteTarget.id) setEditId(null);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error al eliminar");
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
