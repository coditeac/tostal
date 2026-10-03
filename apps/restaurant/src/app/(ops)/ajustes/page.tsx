"use client";

import Link from "next/link";
import { useState } from "react";
import PersonalPanel from "@/components/personal-panel";
import ConfigPanel from "@/components/config-panel";
import ZonasPanel from "@/components/zonas-panel";
import TiendasProveedorPanel from "@/components/tiendas-proveedor-panel";

type Tab = "personal" | "config" | "zonas" | "tiendas";

export default function AjustesPage() {
  const [tab, setTab] = useState<Tab>("personal");

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal, zonas, tiendas de proveedor y configuración — fuera de los 6
          módulos de operación
        </p>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-border text-sm">
        {(
          [
            { id: "personal", label: "Personal" },
            { id: "zonas", label: "Zonas de envío" },
            { id: "tiendas", label: "Tiendas" },
            { id: "config", label: "Config" },
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

      {tab === "personal" ? (
        <PersonalPanel />
      ) : tab === "zonas" ? (
        <ZonasPanel />
      ) : tab === "tiendas" ? (
        <TiendasProveedorPanel />
      ) : (
        <ConfigPanel />
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/productos" className="font-medium text-miel">
          ← Volver a Productos
        </Link>
      </p>
    </div>
  );
}
