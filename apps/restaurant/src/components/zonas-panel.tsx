"use client";

import { useEffect, useState } from "react";
import {
  createZona,
  deleteZona,
  listZonas,
  updateZona,
  type ZonaEnvioRow,
} from "@/lib/data/zonas";
import { formatoMoneda } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";

type FormState = {
  nombre: string;
  cobertura: string;
  costoPesos: string;
  activa: boolean;
  orden: string;
};

const EMPTY: FormState = {
  nombre: "",
  cobertura: "",
  costoPesos: "45",
  activa: true,
  orden: "0",
};

export default function ZonasPanel() {
  const [zonas, setZonas] = useState<ZonaEnvioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ZonaEnvioRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await listZonas();
      setZonas(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las zonas");
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

  function startEdit(z: ZonaEnvioRow) {
    setEditId(z.id);
    setForm({
      nombre: z.nombre,
      cobertura: z.cobertura || "",
      costoPesos: String((z.costo_envio / 100).toFixed(2)).replace(/\.00$/, ""),
      activa: z.activa,
      orden: String(z.orden),
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const costoPesos = Number(form.costoPesos.replace(",", "."));
      if (Number.isNaN(costoPesos) || costoPesos < 0) {
        throw new Error("El costo de envío debe ser un número ≥ 0.");
      }
      const orden = Number.parseInt(form.orden || "0", 10) || 0;
      if (editId === "nuevo") {
        await createZona({
          nombre: form.nombre,
          cobertura: form.cobertura,
          costoPesos,
          activa: form.activa,
          orden,
        });
      } else if (editId) {
        await updateZona({
          id: editId,
          nombre: form.nombre,
          cobertura: form.cobertura,
          costoPesos,
          activa: form.activa,
          orden,
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

  async function toggleActiva(z: ZonaEnvioRow) {
    setError(null);
    try {
      await updateZona({ id: z.id, activa: !z.activa });
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
      await deleteZona(deleteTarget.id);
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
          Zonas activas aparecen en el checkout del Cliente. El costo se calcula
          en el servidor (centavos MXN).
        </p>
        {editId == null && (
          <Button type="button" size="sm" onClick={startNew}>
            Nueva zona
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--tostal-alerta,_#B45309)_12%,white)] px-3 py-2 text-sm text-alerta">
          {error}
        </p>
      )}

      {editId != null && (
        <form
          onSubmit={onSave}
          className="space-y-3 rounded-xl border border-border p-4"
        >
          <h3 className="text-sm font-semibold tracking-tight">
            {editId === "nuevo" ? "Nueva zona" : "Editar zona"}
          </h3>
          <div>
            <label className="label" htmlFor="zona-nombre">
              Nombre
            </label>
            <input
              id="zona-nombre"
              className="field"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Roma / Condesa"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="zona-cobertura">
              Cobertura (opcional)
            </label>
            <input
              id="zona-cobertura"
              className="field"
              value={form.cobertura}
              onChange={(e) => setForm({ ...form, cobertura: e.target.value })}
              placeholder="Colonias o CP cubiertos"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="zona-costo">
                Costo (MXN)
              </label>
              <input
                id="zona-costo"
                className="field"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.costoPesos}
                onChange={(e) =>
                  setForm({ ...form, costoPesos: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="zona-orden">
                Orden
              </label>
              <input
                id="zona-orden"
                className="field"
                type="number"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) =>
                setForm({ ...form, activa: e.target.checked })
              }
            />
            Zona activa (visible en Cliente)
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
        <p className="text-sm text-muted-foreground">Cargando zonas…</p>
      ) : zonas.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Aún no hay zonas. Crea la primera para habilitar envío a domicilio.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {zonas.map((z) => (
            <li
              key={z.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium tracking-tight">{z.nombre}</p>
                  <Badge variant={z.activa ? "default" : "secondary"}>
                    {z.activa ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatoMoneda(z.costo_envio)}
                  {z.cobertura ? ` · ${z.cobertura}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(z)}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void toggleActiva(z)}
                >
                  {z.activa ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Eliminar zona ${z.nombre}`}
                  onClick={() => setDeleteTarget(z)}
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
        title="¿Eliminar zona de envío?"
        description={
          deleteTarget
            ? `«${deleteTarget.nombre}» se eliminará. Si ya se usó en pedidos, se desactivará en su lugar para no romper el historial.`
            : ""
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void onDeleteConfirmed()}
      />
    </div>
  );
}
