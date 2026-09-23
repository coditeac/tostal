"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8">
      <Link href="/" className="text-sm font-semibold text-miel-dark">
        ← Menú
      </Link>
      <h1 className="font-display mt-4 text-4xl">Sigue tu pedido</h1>
      <p className="mt-2 text-sm text-muted">
        Escribe el código que te dimos al confirmar (ej. T-0923-1234).
      </p>

      <form onSubmit={onSubmit} className="surface mt-6 space-y-3 p-4">
        <div>
          <label className="label" htmlFor="codigo">
            Código
          </label>
          <input
            id="codigo"
            className="field uppercase tracking-wide"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="T-0923-1234"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={!codigo.trim()}
        >
          Ver estado
        </button>
      </form>
    </div>
  );
}
