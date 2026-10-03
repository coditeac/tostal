"use client";

import { useEffect, useState } from "react";
import {
  createTiendaProveedor,
  deleteTiendaProveedor,
  listTiendasProveedor,
  updateTiendaProveedor,
  type TiendaProveedorRow,
} from "@/lib/data/tiendas-proveedor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";

type FormState = {
  nombre: string;
  contacto: string;
  notas: string;
  activo: boolean;
};

const EMPTY: FormState = {
  nombre: "",
  contacto: "",
  notas: "",
  activo: true,
};

export default function TiendasProveedorPanel() {
  const [tiendas, setTiendas] = useState<TiendaProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TiendaProveedorRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await listTiendasProveedor({ soloActivas: false });
      setTiendas(list);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar las tiendas"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startNew() {
    setEditId("nuevo");
    setForm(EMPTY);
  }

  function startEdit(t: TiendaProveedorRow) {
    setEditId(t.id);
    setForm({
      nombre: t.nombre,
      contacto: t.contacto || "",
      notas: t.notas || "",
      activo: t.activo,
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editId === "nuevo") {
        await createTiendaProveedor({
          nombre: form.nombre,
          contacto: form.contacto,
          notas: form.notas,
          activo: form.activo,
        });
      } else if (editId) {
        await updateTiendaProveedor({
          id: editId,
          nombre: form.nombre,
          contacto: form.contacto,
          notas: form.notas,
          activo: form.activo,
        });
      }
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiva(t: TiendaProveedorRow) {
    setError(null);
    try {
      await updateTiendaProveedor({ id: t.id, activo: !t.activo });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  async function onDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTiendaProveedor(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tiendas o proveedores donde compras insumos. El listado activo aparece
          en Compras y Almacén.
        </p>
        {editId == null && (
          <Button type="button" size="sm" onClick={startNew}>
            Nueva tienda
          </Button>
        )}
      </div>

      {error && (
        <p
          className="rounded-xl bg-[color-mix(in_srgb,var(--tostal-alerta,_#B45309)_12%,white)] px-3 py-2 text-sm text-alerta"
          role="alert"
        >
          {error}
        </p>
      )}

      {editId != null && (
        <form
          onSubmit={onSave}
          className="space-y-3 rounded-xl border border-border p-4"
        >
          <h3 className="text-sm font-semibold tracking-tight">
            {editId === "nuevo" ? "Nueva tienda" : "Editar tienda"}
          </h3>
          <div>
            <label className="label" htmlFor="tienda-nombre">
              Nombre
            </label>
            <input
              id="tienda-nombre"
              className="field"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Costco, Central de Abastos…"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="tienda-contacto">
              Contacto (opcional)
            </label>
            <input
              id="tienda-contacto"
              className="field"
              value={form.contacto}
              onChange={(e) => setForm({ ...form, contacto: e.target.value })}
              placeholder="Teléfono, WhatsApp o persona"
            />
          </div>
          <div>
            <label className="label" htmlFor="tienda-notas">
              Notas (opcional)
            </label>
            <textarea
              id="tienda-notas"
              className="field min-h-[72px]"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Horarios, qué conviene comprar ahí…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) =>
                setForm({ ...form, activo: e.target.checked })
              }
            />
            Tienda activa (visible en Compras y Almacén)
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditId(null)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando tiendas…</p>
      ) : tiendas.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Aún no hay tiendas. Agrega la primera para usarla en Compras e
          insumos.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {tiendas.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium tracking-tight">{t.nombre}</p>
                  <Badge variant={t.activo ? "default" : "secondary"}>
                    {t.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                {(t.contacto || t.notas) && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[t.contacto, t.notas].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(t)}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void toggleActiva(t)}
                >
                  {t.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Eliminar tienda ${t.nombre}`}
                  onClick={() => setDeleteTarget(t)}
                >
                  Eliminar
                </Button>
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
        title="¿Eliminar tienda?"
        description={
          deleteTarget
            ? `«${deleteTarget.nombre}» se eliminará. Si ya se usó en compras o insumos, se desactivará para no romper el historial.`
            : ""
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void onDeleteConfirmed()}
      />
    </div>
  );
}
