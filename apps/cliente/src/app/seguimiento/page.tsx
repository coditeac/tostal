"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SeguimientoPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = codigo.trim().toUpperCase();
    if (!clean) return;
    router.push(`/pedido/${encodeURIComponent(clean)}`);
  }

  return (
    <div className="page-shell px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Button variant="link" asChild className="h-auto px-0 text-miel">
        <Link href="/">← Menú</Link>
      </Button>

      <div className="mt-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tostal-logo-marca.png"
          alt="Tostal"
          width={180}
          height={76}
          className="h-11 w-auto object-contain"
        />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">
          Sigue tu pedido
        </h1>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Escribe el código que te dimos al confirmar (ej. T-0923-1234).
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            className="uppercase tracking-wide"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="T-0923-1234"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
        <Button type="submit" className="w-full" disabled={!codigo.trim()}>
          Ver estado
        </Button>
      </form>
    </div>
  );
}
