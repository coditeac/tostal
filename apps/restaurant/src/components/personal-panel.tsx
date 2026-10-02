"use client";

import { useEffect, useState } from "react";
import {
  createStaffUser,
  listStaff,
  updateStaffProfile,
  type StaffUser,
} from "@/lib/data/usuarios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  async function toggleActivo(u: User) {
    await updateStaffProfile({ id: u.id, activo: !u.activo });
    await load();
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
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleActivo(u)}
                  >
                    {u.activo ? "Desactivar" : "Activar"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

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
