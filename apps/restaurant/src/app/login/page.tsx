"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isStaffRol } from "@/lib/roles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

function mensajeAuth(raw: string | undefined): string {
  const m = (raw || "").toLowerCase();
  if (
    m.includes("invalid login") ||
    m.includes("invalid credentials") ||
    m.includes("invalid_credentials")
  ) {
    return "Correo o contraseña incorrectos.";
  }
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return "Confirma tu correo antes de entrar.";
  }
  if (m.includes("too many") || m.includes("rate limit")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Error de conexión. Intenta de nuevo.";
  }
  return "No se pudo entrar. Revisa correo y contraseña.";
}

export default function LoginPage() {
  const router = useRouter();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authErr) {
        setError(mensajeAuth(authErr.message));
        return;
      }
      const uid = data.user?.id;
      if (!uid) {
        setError("Sesión inválida");
        return;
      }
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("rol, activo")
        .eq("id", uid)
        .maybeSingle();
      if (pErr || !profile?.activo || !isStaffRol(profile.rol)) {
        await supabase.auth.signOut();
        setError("Esta cuenta no es staff de Tostal.");
        return;
      }
      router.push("/productos");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="toastal-shell mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="hero-brand flex flex-col items-center justify-end bg-miel px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))] text-center rise-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tostal-logo.png"
          alt="Tostal — Sabores que unen culturas"
          width={280}
          height={120}
          className="h-auto w-[min(70%,13.5rem)] object-contain"
        />
      </header>

      <main
        className="flex flex-1 flex-col px-6 pb-10 pt-8 rise-in"
        style={{ animationDelay: "80ms" }}
      >
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Operación
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Entrar al equipo
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Solo para personal Tostal (superadmin, admin, cocina, caja).
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5"
          aria-describedby={error ? errorId : undefined}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={error ? true : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-12"
                aria-invalid={error ? true : undefined}
              />
              <button
                type="button"
                className="absolute top-1/2 right-1.5 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff size={18} strokeWidth={1.75} aria-hidden />
                ) : (
                  <Eye size={18} strokeWidth={1.75} aria-hidden />
                )}
              </button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" id={errorId}>
              <AlertDescription className="font-medium text-destructive">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Spinner aria-label="Cargando" />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Acceso con la cuenta que te creó el superadmin.
        </p>
      </main>
    </div>
  );
}
