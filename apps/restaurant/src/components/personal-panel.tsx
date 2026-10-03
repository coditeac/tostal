"use client";

import { useEffect, useState } from "react";
import {
  createStaffUser,
  deleteStaffUser,
  listStaff,
  updateStaffProfile,
  type StaffUser,
} from "@/lib/data/usuarios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";

type User = StaffUser;

const ROLES_CREABLES: Array<User["rol"]> = ["admin", "cocina", "caja"];

export default function PersonalPanel() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    nombre: "",
    password: "",
    rol: "caja" as User["rol"],
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await listStaff();
      setUsuarios(list);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sin permiso (solo admin/superadmin)"
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
    setForm({ email: "", nombre: "", password: "", rol: "caja" });
  }

  function startEdit(u: User) {
    setEditId(u.id);
    setForm({
      email: u.email,
      nombre: u.nombre,
      password: "",
      rol: u.rol === "superadmin" ? "admin" : u.rol,
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editId === "nuevo") {
        await createStaffUser({
          email: form.email,
          nombre: form.nombre,
          password: form.password,
          rol: form.rol,
        });
      } else if (editId) {
        await updateStaffProfile({
          id: editId,
          nombre: form.nombre,
          rol: form.rol,
        });
        if (form.password.trim()) {
          setError(
            "Perfil actualizado. Cambio de contraseña requiere service_role (Dashboard/Railway)."
          );
        }
      }
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onArchiveConfirmed() {
    if (!archiveTarget) return;
    setArchiving(true);
    setError(null);
    try {
      await updateStaffProfile({
        id: archiveTarget.id,
        activo: !archiveTarget.activo,
      });
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setArchiving(false);
    }
  }

  async function onDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteStaffUser(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cuentas staff (admin, cocina, caja). Solo superadmin/admin. Superadmin:{" "}
          <span className="font-medium text-foreground">cocina@tostal.cafe</span>
        </p>
        <Button type="button" size="sm" onClick={startNew}>
          Nuevo
        </Button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="loading-pulse text-muted-foreground">Cargando…</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">
                  {u.nombre}{" "}
                  {!u.activo && (
                    <Badge variant="secondary" size="sm">
                      inactivo
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.email} · {u.rol}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(u)}
                >
                  Editar
                </Button>
                {u.rol !== "superadmin" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={
                        u.activo
                          ? `Desactivar ${u.nombre}`
                          : `Activar ${u.nombre}`
                      }
                      onClick={() => setArchiveTarget(u)}
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </Button>
                    {u.activo ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-error"
                        aria-label={`Eliminar ${u.nombre}`}
                        onClick={() => setDeleteTarget(u)}
                      >
                        Eliminar
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title={
          archiveTarget?.activo
            ? "¿Desactivar cuenta staff?"
            : "¿Activar cuenta staff?"
        }
        description={
          archiveTarget
            ? archiveTarget.activo
              ? `«${archiveTarget.nombre}» no podrá iniciar sesión hasta reactivarla. El historial se conserva.`
              : `«${archiveTarget.nombre}» volverá a poder iniciar sesión con su rol actual.`
            : ""
        }
        confirmLabel={archiveTarget?.activo ? "Desactivar" : "Activar"}
        destructive={!!archiveTarget?.activo}
        busy={archiving}
        onConfirm={() => void onArchiveConfirmed()}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="¿Eliminar cuenta staff?"
        description={
          deleteTarget
            ? `«${deleteTarget.nombre}» (${deleteTarget.email}) se desactivará. No se borra el usuario de Auth; no podrá iniciar sesión. No se puede eliminar el único superadmin.`
            : ""
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void onDeleteConfirmed()}
      />

      {editId && (
        <form onSubmit={onSave} className="space-y-3 border-t border-border pt-4">
          <h2 className="font-semibold">
            {editId === "nuevo" ? "Nuevo staff" : "Editar"}
          </h2>
          {editId === "nuevo" && (
            <input
              className="field"
              type="email"
              placeholder="Correo"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          )}
          <input
            className="field"
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
          <input
            className="field"
            type="password"
            placeholder={
              editId === "nuevo" ? "Contraseña" : "Nueva contraseña (opcional)"
            }
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={editId === "nuevo"}
            minLength={6}
          />
          <select
            className="field"
            value={form.rol}
            onChange={(e) =>
              setForm({ ...form, rol: e.target.value as User["rol"] })
            }
          >
            {ROLES_CREABLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditId(null)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
