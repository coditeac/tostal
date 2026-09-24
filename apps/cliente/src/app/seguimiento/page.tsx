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
    <div className="page-shell px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm font-semibold text-miel">
        ← Menú
      </Link>

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

      <p className="mt-3 text-sm leading-relaxed text-muted">
        Escribe el código que te dimos al confirmar (ej. T-0923-1234).
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
