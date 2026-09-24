"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useClienteSession } from "@/lib/cliente-auth";
import { getApiBase } from "@/lib/api";
import { CLIENTE_AUTH_API } from "@tostal/shared/api-public";
import type { PedidoPublico } from "@tostal/shared/types";
import { formatoMoneda } from "@/lib/api";

export default function CuentaPage() {
  const { user, loading, login, register, logout, refresh } =
    useClienteSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoPublico[]>([]);

  async function loadPedidos() {
    try {
      const res = await fetch(`${getApiBase()}${CLIENTE_AUTH_API.pedidos}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setPedidos(data.pedidos || []);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({ email, password, nombre, telefono });
      }
      await refresh();
      await loadPedidos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10 text-sm text-muted-foreground">
        Cargando cuenta…
      </div>
    );
  }

  if (user) {
    if (pedidos.length === 0) void loadPedidos();
    return (
      <div className="mx-auto max-w-lg space-y-5 px-5 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Tu cuenta
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-cacao">{user.nombre}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <section className="rounded-2xl border border-border bg-white p-4">
          <h2 className="font-semibold">Historial de pedidos</h2>
          {pedidos.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aún no hay pedidos ligados a esta cuenta.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {pedidos.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <Link
                      href={`/pedido/${p.codigo}`}
                      className="font-medium text-miel"
                    >
                      {p.codigo}
                    </Link>
                    <p className="text-muted-foreground">
                      {p.fechaEntrega} · {p.estado.replace("_", " ")}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {formatoMoneda(p.total)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-sm font-semibold text-muted-foreground"
        >
          Cerrar sesión
        </button>
        <p>
          <Link href="/" className="text-sm font-semibold text-miel">
            ← Volver al menú
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-cacao">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El menú se ve sin cuenta. Al pedir, recomendamos cuenta (o guest +
          email).
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border bg-white p-4">
        {mode === "register" && (
          <>
            <input
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <input
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              placeholder="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </>
        )}
        <input
          className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-cacao py-2.5 text-sm font-semibold text-white"
        >
          {busy
            ? "…"
            : mode === "login"
              ? "Entrar"
              : "Crear cuenta"}
        </button>
      </form>
      <button
        type="button"
        className="text-sm font-semibold text-miel"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login"
          ? "¿No tienes cuenta? Regístrate"
          : "¿Ya tienes cuenta? Inicia sesión"}
      </button>
      <p>
        <Link href="/" className="text-sm text-muted-foreground">
          ← Seguir viendo el menú
        </Link>
      </p>
    </div>
  );
}
