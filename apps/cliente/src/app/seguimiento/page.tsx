"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { resolverSeguimiento } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SeguimientoPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = codigo.trim().toUpperCase();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      const r = await resolverSeguimiento(clean);
      if (r.tipo === "pedido") {
        router.push(`/pedido/${encodeURIComponent(r.codigo)}`);
        return;
      }
      if (r.tipo === "reserva") {
        router.push(`/reserva/${encodeURIComponent(r.codigo)}`);
        return;
      }
      setError(r.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell px-6 pb-12 pt-[max(1.75rem,env(safe-area-inset-top))]">
      <Button variant="link" asChild className="h-auto px-0 text-miel">
        <Link href="/">← Menú</Link>
      </Button>

      <div className="mt-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tostal-logo-marca.png"
          alt="Tostal"
          width={180}
          height={76}
          className="h-10 w-auto object-contain"
        />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Sigue tu pedido
        </h1>
      </div>

      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Escribe el código de tu pedido (T-…) o reserva (R-…) para ver el estado
        y el avance.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-10 space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            className="uppercase tracking-wide"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="T-1002-1234 o R-1002-5678"
            autoComplete="off"
            autoCapitalize="characters"
            aria-invalid={!!error}
            aria-describedby={error ? "seguimiento-error" : undefined}
          />
        </div>
        {error && (
          <Alert variant="destructive" id="seguimiento-error" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!codigo.trim() || busy}
          aria-busy={busy}
        >
          {busy ? "Buscando…" : "Ver estado"}
        </Button>
      </form>
    </div>
  );
}
