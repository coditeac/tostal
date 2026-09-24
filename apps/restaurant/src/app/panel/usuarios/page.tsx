"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type User = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "cocina" | "caja";
  activo: boolean;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    nombre: "",
    password: "",
    rol: "caja" as User["rol"],
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await apiFetch("/api/usuarios");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sin permiso (solo admin)");
      return;
    }
    setUsuarios(data.usuarios || []);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/usuarios", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear");
      setForm({ email: "", nombre: "", password: "", rol: "caja" });
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
    <div className="space-y-5 rise-in">
      <section className="surface p-5">
        <h1 className="text-xl font-semibold text-cacao">Personal Tostal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El admin crea cuentas con rol admin, cocina o caja. Login en esta app.
        </p>
        {error && <p className="mt-3 text-sm text-alerta">{error}</p>}
      </section>

      <section className="surface p-5">
        <h2 className="font-semibold">Nuevo usuario</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
          <input
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="Contraseña (mín. 6)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
          <select
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={form.rol}
            onChange={(e) =>
              setForm({ ...form, rol: e.target.value as User["rol"] })
            }
          >
            <option value="admin">admin</option>
            <option value="cocina">cocina</option>
            <option value="caja">caja</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-cacao px-4 py-2 text-sm font-semibold text-white sm:col-span-2"
          >
            {saving ? "Creando…" : "Crear usuario"}
          </button>
        </form>
      </section>

      <section className="surface p-5">
        <h2 className="font-semibold">Usuarios</h2>
        <ul className="mt-3 divide-y divide-border">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {u.nombre}{" "}
                  <span className="text-muted-foreground">({u.rol})</span>
                </p>
                <p className="text-muted-foreground">{u.email}</p>
              </div>
              <button
                type="button"
                onClick={() => void toggleActivo(u)}
                className="text-xs font-semibold text-miel"
              >
                {u.activo ? "Desactivar" : "Activar"}
              </button>
            </li>
          ))}
          {usuarios.length === 0 && !error && (
            <li className="py-2 text-sm text-muted-foreground">Sin usuarios.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
