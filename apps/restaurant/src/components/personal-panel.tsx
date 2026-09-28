"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type User = {
  id: string;
  email: string;
  nombre: string;
  rol: "superadmin" | "admin" | "cocina" | "caja";
  activo: boolean;
};

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
    const res = await apiFetch("/api/usuarios");
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Sin permiso (solo admin/superadmin)");
      return;
    }
    setUsuarios(data.usuarios || []);
    setError(null);
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
        const res = await apiFetch("/api/usuarios", {
          method: "POST",
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo crear");
      } else if (editId) {
        const body: Record<string, unknown> = {
          id: editId,
          nombre: form.nombre,
          rol: form.rol,
        };
        if (form.password.trim()) body.password = form.password;
        const res = await apiFetch("/api/usuarios", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo actualizar");
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
    const res = await apiFetch("/api/usuarios", {
      method: "PATCH",
      body: JSON.stringify({ id: u.id, activo: !u.activo }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cuentas staff (admin, cocina, caja). Solo superadmin/admin.
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

      {editId && (
        <form
          onSubmit={(e) => void onSave(e)}
          className="space-y-3 border-y border-border py-4"
        >
          <h2 className="font-semibold">
            {editId === "nuevo" ? "Nueva cuenta" : "Editar cuenta"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nombre</label>
              <input
                className="field"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="field"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required={editId === "nuevo"}
                disabled={editId !== "nuevo"}
              />
            </div>
            <div>
              <label className="label">
                {editId === "nuevo"
                  ? "Contraseña"
                  : "Nueva contraseña (opcional)"}
              </label>
              <input
                className="field"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={editId === "nuevo"}
                minLength={editId === "nuevo" ? 6 : undefined}
                placeholder={editId === "nuevo" ? "Mín. 6" : "Sin cambios"}
              />
            </div>
            <div>
              <label className="label">Rol</label>
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
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditId(null)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="loading-pulse text-sm text-muted-foreground">
          Cargando personal…
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 py-3.5"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {u.nombre}{" "}
                  <Badge
                    variant={u.activo ? "secondary" : "outline"}
                    radius="default"
                    className="ml-1 align-middle"
                  >
                    {u.rol}
                  </Badge>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {u.email}
                  {!u.activo ? " · inactivo" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-3 text-xs font-semibold">
                {u.rol !== "superadmin" && (
                  <button
                    type="button"
                    className="text-miel"
                    onClick={() => startEdit(u)}
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => void toggleActivo(u)}
                >
                  {u.activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            </li>
          ))}
          {usuarios.length === 0 && !error && (
            <li className="py-4 text-sm text-muted-foreground">
              Sin usuarios. Crea el primero con el botón Nuevo.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
