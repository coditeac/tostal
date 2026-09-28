"use client";

import { apiFetch } from "@/lib/api";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/login", {
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
      <div className="rise-in overflow-hidden rounded-[1rem] border border-border bg-white">
        <div className="flex flex-col items-center bg-miel px-6 py-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tostal-logo.png"
            alt="Tostal — Sabores que unen culturas"
            width={280}
            height={120}
            className="h-auto w-[min(72%,14rem)] object-contain"
          />
        </div>

        <div className="px-6 pb-0 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Operación
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight">
            Entrar al equipo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo para personal Tostal (superadmin, admin, cocina, caja).
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Spinner />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground">
            Acceso con la cuenta que te creó el superadmin.
          </p>
        </div>
      </div>
    </div>
  );
}
