"use client";

import { useState } from "react";
import { AlmacenStock } from "@/components/almacen-stock";
import { InsumosCatalogo } from "@/components/insumos-catalogo";

type Tab = "stock" | "insumos";

export default function AlmacenPage() {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Almacén</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Insumos, mínimos y alerta cuando hay pocos
        </p>
      </div>

      <div className="flex gap-4 border-b border-border text-sm">
        {(
          [
            { id: "stock", label: "Stock" },
            { id: "insumos", label: "Insumos" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 pb-2.5 transition-colors ${
              tab === t.id
                ? "border-miel font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" ? <AlmacenStock /> : <InsumosCatalogo />}
    </div>
  );
}
