"use client";

import { createClient } from "@/lib/supabase/client";
import { listInsumos, mapInsumoUi, createInsumo } from "./insumos";
import { listTiendasProveedor } from "./tiendas-proveedor";

export async function loadComprasSugerencia(_tiendaId?: string) {
  const insumos = await listInsumos();
  const mapped = insumos.map(mapInsumoUi);
  const sugerencia = mapped
    .filter((i) => i.bajoMinimo)
    .map((i) => ({
      insumoId: i.id,
      nombre: i.nombre,
      unidad: i.unidad,
      stockActual: i.stockActual,
      stockMinimo: i.stockMinimo,
      cantidadSugerida: Math.max(1, i.stockMinimo - i.stockActual),
      proveedor: i.proveedorPreferido as string | null,
      proveedorId: i.proveedorPreferidoId as string | null,
      motivo: "Stock bajo el umbral",
      costoUnitario: i.costoUnitario,
      paraTienda: true,
    }));

  const tiendas = await listTiendasProveedor({ soloActivas: true });

  return {
    sugerencia,
    tiendas: tiendas.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      preferido: false,
    })),
    insumos: mapped,
  };
}

export async function altaInsumoCompra(input: {
  nombre: string;
  unidad: string;
  cantidad: number;
  costoPesos: number;
  stockMinimo?: number;
  proveedorPreferidoId?: string | null;
}) {
  const costoCentavos = Math.round(Number(input.costoPesos) * 100);
  let proveedorNombre: string | null = null;
  if (input.proveedorPreferidoId) {
    const tiendas = await listTiendasProveedor({ soloActivas: false });
    proveedorNombre =
      tiendas.find((t) => t.id === input.proveedorPreferidoId)?.nombre ?? null;
  }
  const row = await createInsumo({
    nombre: input.nombre.trim(),
    unidad: input.unidad || "u",
    stock: 0,
    umbral_pocos: Number(input.stockMinimo) || 0,
    costo_unitario: costoCentavos,
    proveedor_preferido_id: input.proveedorPreferidoId ?? null,
    proveedor_preferido: proveedorNombre,
  });
  return mapInsumoUi(row);
}

export async function cerrarCompra(input: {
  tiendaId: string;
  tiendaNombre: string;
  lineas: Array<{
    insumoId: string;
    nombre: string;
    cantidad: number;
    costoPesos: number;
  }>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tiendaNombre = input.tiendaNombre.trim();
  const tiendaId = input.tiendaId.trim();
  if (!tiendaId || !tiendaNombre) {
    throw new Error("Selecciona una tienda de proveedor.");
  }

  const lineas = input.lineas.filter(
    (l) => l.insumoId && Number(l.cantidad) > 0
  );
  if (!lineas.length) throw new Error("Agrega al menos una línea");

  const totalCentavos = lineas.reduce((acc, l) => {
    return acc + Math.round(Number(l.cantidad) * Number(l.costoPesos) * 100);
  }, 0);

  const { data: compra, error: e1 } = await supabase
    .from("compras")
    .insert({
      tienda: tiendaNombre,
      tienda_proveedor_id: tiendaId,
      estado: "abierta",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (e1 || !compra) throw new Error(e1?.message || "No se pudo crear compra");

  const items = lineas.map((l) => {
    const costo = Math.round(Number(l.costoPesos) * 100);
    const qty = Number(l.cantidad);
    return {
      compra_id: compra.id,
      insumo_id: l.insumoId,
      nombre: l.nombre,
      cantidad: qty,
      costo_unitario: costo,
      subtotal: Math.round(qty * costo),
    };
  });

  const { error: e2 } = await supabase.from("compra_items").insert(items);
  if (e2) throw new Error(e2.message);

  for (const l of lineas) {
    const { data: insumo, error } = await supabase
      .from("insumos")
      .select("id, stock, costo_unitario, proveedor_preferido_id")
      .eq("id", l.insumoId)
      .single();
    if (error || !insumo) throw new Error(error?.message || "Insumo faltante");
    const costo = Math.round(Number(l.costoPesos) * 100);
    const patch: {
      stock: number;
      costo_unitario: number;
      updated_at: string;
      proveedor_preferido_id?: string;
      proveedor_preferido?: string;
    } = {
      stock: Number(insumo.stock) + Number(l.cantidad),
      costo_unitario: costo,
      updated_at: new Date().toISOString(),
    };
    if (!insumo.proveedor_preferido_id) {
      patch.proveedor_preferido_id = tiendaId;
      patch.proveedor_preferido = tiendaNombre;
    }
    const { error: eUp } = await supabase
      .from("insumos")
      .update(patch)
      .eq("id", l.insumoId);
    if (eUp) throw new Error(eUp.message);
  }

  const { data: gasto, error: e3 } = await supabase
    .from("gastos")
    .insert({
      concepto: `Compra ${tiendaNombre}`,
      monto: totalCentavos,
      tienda: tiendaNombre,
      tienda_proveedor_id: tiendaId,
      categoria: "compras",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (e3) throw new Error(e3.message);

  const { error: e4 } = await supabase
    .from("compras")
    .update({
      estado: "cerrada",
      gasto_id: gasto.id,
      closed_at: new Date().toISOString(),
    })
    .eq("id", compra.id);
  if (e4) throw new Error(e4.message);

  return { compra, gasto };
}

export type CompraReciente = {
  id: string;
  tienda: string;
  tienda_proveedor_id: string | null;
  estado: string;
  gasto_id: string | null;
  closed_at: string | null;
  created_at: string;
  total: number;
};

/** Últimas compras cerradas/anuladas para listado en panel. */
export async function listComprasRecientes(
  limit = 20
): Promise<CompraReciente[]> {
  const supabase = createClient();
  const { data: compras, error } = await supabase
    .from("compras")
    .select("id, tienda, tienda_proveedor_id, estado, gasto_id, closed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!compras?.length) return [];

  const ids = compras.map((c) => c.id);
  const { data: items } = await supabase
    .from("compra_items")
    .select("compra_id, subtotal")
    .in("compra_id", ids);
  const totals = new Map<string, number>();
  for (const it of items || []) {
    totals.set(
      it.compra_id,
      (totals.get(it.compra_id) || 0) + (Number(it.subtotal) || 0)
    );
  }

  return compras.map((c) => ({
    id: c.id,
    tienda: c.tienda || "",
    tienda_proveedor_id: c.tienda_proveedor_id,
    estado: c.estado || "",
    gasto_id: c.gasto_id,
    closed_at: c.closed_at,
    created_at: c.created_at,
    total: totals.get(c.id) || 0,
  }));
}

/**
 * Anula compra: conserva historial; no revierte stock.
 * El gasto vinculado se puede borrar aparte en Finanzas.
 */
export async function anularCompra(id: string): Promise<void> {
  const supabase = createClient();
  const { data: row, error: e0 } = await supabase
    .from("compras")
    .select("id, estado")
    .eq("id", id)
    .single();
  if (e0 || !row) throw new Error(e0?.message || "Compra no encontrada");
  if (row.estado === "anulada") return;

  const { error } = await supabase
    .from("compras")
    .update({ estado: "anulada" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
