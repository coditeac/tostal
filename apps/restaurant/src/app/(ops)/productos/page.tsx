"use client";

import { useState } from "react";
import { ProductosCatalogo } from "@/components/productos-catalogo";
import { MenuDiaPanel } from "@/components/menu-dia-panel";
import { ModuleTabPanel, ModuleTabs } from "@/components/module-tabs";

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

      <ModuleTabs
        label="Secciones de productos"
        tabs={[
          { id: "catalogo", label: "Catálogo" },
          { id: "dia", label: "Día de venta" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <ModuleTabPanel id="catalogo" labelledBy="catalogo" active={tab === "catalogo"}>
        <ProductosCatalogo />
      </ModuleTabPanel>
      <ModuleTabPanel id="dia" labelledBy="dia" active={tab === "dia"}>
        <MenuDiaPanel />
      </ModuleTabPanel>
    </div>
  );
}
