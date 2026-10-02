"use client";

import { useState } from "react";
import { AlmacenStock } from "@/components/almacen-stock";
import { InsumosCatalogo } from "@/components/insumos-catalogo";
import { ModuleTabPanel, ModuleTabs } from "@/components/module-tabs";

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

      <ModuleTabs
        label="Secciones de almacén"
        tabs={[
          { id: "stock", label: "Stock" },
          { id: "insumos", label: "Insumos" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <ModuleTabPanel id="stock" labelledBy="stock" active={tab === "stock"}>
        <AlmacenStock />
      </ModuleTabPanel>
      <ModuleTabPanel id="insumos" labelledBy="insumos" active={tab === "insumos"}>
        <InsumosCatalogo />
      </ModuleTabPanel>
    </div>
  );
}
