"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@tostal.mx");
  const [password, setPassword] = useState("tostal123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo entrar");
        return;
      }
      router.push("/panel");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="toastal-shell mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rise-in overflow-hidden rounded-[1.1rem] border border-border bg-white">
        <div className="flex flex-col items-center bg-miel px-6 py-9 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tostal-logo.png"
            alt="Tostal"
            width={280}
            height={120}
            className="h-auto w-[min(72%,14rem)] object-contain"
          />
        </div>

        <div className="px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Operación
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight">
            Entrar al equipo
          </h1>
          <p className="mt-1 text-sm text-muted">
            Solo para admin, cocina y caja.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                className="field"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-4 text-xs text-muted">
            Demo: admin@tostal.mx / tostal123
          </p>
        </div>
      </div>
    </div>
  );
}
