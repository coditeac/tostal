"use client";

import { useState } from "react";
import { ProductosCatalogo } from "@/components/productos-catalogo";
import { MenuDiaPanel } from "@/components/menu-dia-panel";

type Tab = "catalogo" | "dia";

export default function ProductosPage() {
  const [tab, setTab] = useState<Tab>("catalogo");

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogo, recetas y activación por día de venta (CDMX)
        </p>
      </div>

      <div className="flex gap-4 border-b border-border text-sm">
        {(
          [
            { id: "catalogo", label: "Catálogo" },
            { id: "dia", label: "Día de venta" },
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

      {tab === "catalogo" ? <ProductosCatalogo /> : <MenuDiaPanel />}
    </div>
  );
}
