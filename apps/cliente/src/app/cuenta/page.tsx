"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { useClienteSession } from "@/lib/cliente-auth";
import { mensajeAuthError } from "@/lib/auth-errors";
import { fetchMisPedidos, formatoMoneda } from "@/lib/api";
import { labelEstado } from "@/lib/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type PedidoResumen = {
  id: string;
  codigo: string;
  fechaEntrega: string;
  estado: string;
  total: number;
};

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
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const formId = useId();
  const errorId = `${formId}-error`;

  useEffect(() => {
    if (!user) {
      setPedidos([]);
      return;
    }
    let alive = true;
    setPedidosLoading(true);
    fetchMisPedidos()
      .then((list) => {
        if (alive) setPedidos(list);
      })
      .catch(() => {
        if (alive) setPedidos([]);
      })
      .finally(() => {
        if (alive) setPedidosLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

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
    } catch (err) {
      setError(
        mensajeAuthError(
          err,
          mode === "login"
            ? "No se pudo iniciar sesión"
            : "No se pudo crear la cuenta"
        )
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        className="mx-auto flex max-w-lg items-center gap-2 px-5 py-10 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Spinner className="size-4" />
        Cargando cuenta…
      </div>
    );
  }

  if (user) {
    return (
      <div className="mx-auto max-w-lg space-y-5 px-5 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Tu cuenta
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-cacao">
            {user.nombre}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <section
          className="rounded-2xl border border-border bg-white p-4"
          aria-labelledby={`${formId}-historial`}
        >
          <h2 id={`${formId}-historial`} className="font-semibold">
            Historial de pedidos
          </h2>
          {pedidosLoading ? (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              Cargando pedidos…
            </p>
          ) : pedidos.length === 0 ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Aún no hay pedidos ligados a esta cuenta. Aquí verás los que
                hagas con este email.
              </p>
              <Button asChild>
                <Link href="/">Ver menú de hoy</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {pedidos.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between gap-3 py-2.5 text-sm"
                >
                  <div>
                    <Link
                      href={`/pedido/${p.codigo}`}
                      className="font-medium text-miel underline-offset-2 hover:underline"
                    >
                      {p.codigo}
                      <span className="sr-only">
                        {" "}
                        — {labelEstado(p.estado)}
                      </span>
                    </Link>
                    <p className="text-muted-foreground">
                      {p.fechaEntrega} · {labelEstado(p.estado)}
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
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-0 text-sm font-semibold text-muted-foreground"
          onClick={() => void logout()}
        >
          Cerrar sesión
        </Button>
        <p>
          <Link
            href="/"
            className="text-sm font-semibold text-miel underline-offset-2 hover:underline"
          >
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
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-border bg-white p-4"
        aria-describedby={error ? errorId : undefined}
        noValidate
      >
        {mode === "register" && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-nombre`}>Nombre</Label>
              <Input
                id={`${formId}-nombre`}
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-telefono`}>Teléfono (opcional)</Label>
              <Input
                id={`${formId}-telefono`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-email`}>Email</Label>
          <Input
            id={`${formId}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={!!error}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-password`}>Contraseña</Label>
          <Input
            id={`${formId}-password`}
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            aria-invalid={!!error}
          />
        </div>
        {error && (
          <Alert variant="destructive" id={errorId} role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <Spinner />
              {mode === "login" ? "Entrando…" : "Creando…"}
            </>
          ) : mode === "login" ? (
            "Entrar"
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </form>
      <Button
        type="button"
        variant="link"
        className="h-auto px-0 text-sm font-semibold text-miel"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError(null);
        }}
      >
        {mode === "login"
          ? "¿No tienes cuenta? Regístrate"
          : "¿Ya tienes cuenta? Inicia sesión"}
      </Button>
      <p>
        <Link href="/" className="text-sm text-muted-foreground">
          ← Seguir viendo el menú
        </Link>
      </p>
    </div>
  );
}
