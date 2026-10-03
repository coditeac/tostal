"use client";

import { createClient } from "@/lib/supabase/client";

export type InsumoRow = {
  id: string;
  nombre: string;
  unidad: string;
  stock: number;
  umbral_pocos: number;
  costo_unitario: number;
  activo: boolean;
};

/** Mapeo UI Nest-compat (centavos en costoUnitario). */
export function mapInsumoUi(i: InsumoRow) {
  const stock = Number(i.stock) || 0;
  const min = Number(i.umbral_pocos) || 0;
  return {
    id: i.id,
    nombre: i.nombre,
    unidad: i.unidad,
    stockActual: stock,
    stock_actual: stock,
    stockMinimo: min,
    stock_minimo: min,
    umbral_pocos: min,
    costoUnitario: Number(i.costo_unitario) || 0,
    costo_unitario: Number(i.costo_unitario) || 0,
    bajoMinimo: stock <= min,
    pocos: stock <= min,
    activo: i.activo,
  };
}

export async function listInsumos(opts?: { q?: string; limit?: number }) {
  const supabase = createClient();
  let q = supabase
    .from("insumos")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (opts?.q?.trim()) {
    q = q.ilike("nombre", `%${opts.q.trim()}%`);
  }
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as InsumoRow[];
}

export async function createInsumo(input: {
  nombre: string;
  unidad: string;
  stock?: number;
  umbral_pocos?: number;
  costo_unitario?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("insumos")
    .insert({
      nombre: input.nombre,
      unidad: input.unidad || "u",
      stock: input.stock ?? 0,
      umbral_pocos: input.umbral_pocos ?? 0,
      costo_unitario: input.costo_unitario ?? 0,
      activo: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as InsumoRow;
}

export async function updateInsumo(
  id: string,
  patch: Partial<{
    nombre: string;
    unidad: string;
    stock: number;
    umbral_pocos: number;
    costo_unitario: number;
    activo: boolean;
  }>
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("insumos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as InsumoRow;
}

/**
 * Elimina insumo: hard delete si no está en recetas/compras;
 * soft (`activo=false`) si hay uso histórico.
 */
export async function deleteInsumo(
  id: string
): Promise<"hard" | "soft"> {
  const supabase = createClient();

  const [{ count: recetaCount }, { count: compraCount }] = await Promise.all([
    supabase
      .from("producto_insumos")
      .select("id", { count: "exact", head: true })
      .eq("insumo_id", id),
    supabase
      .from("compra_items")
      .select("id", { count: "exact", head: true })
      .eq("insumo_id", id),
  ]);

  const enUso = (recetaCount ?? 0) > 0 || (compraCount ?? 0) > 0;
  if (enUso) {
    const { error } = await supabase
      .from("insumos")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return "soft";
  }

  const { error } = await supabase.from("insumos").delete().eq("id", id);
  if (error) {
    if (/foreign key|violates/i.test(error.message)) {
      const { error: e2 } = await supabase
        .from("insumos")
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (e2) throw new Error(e2.message);
      return "soft";
    }
    throw new Error(error.message);
  }
  return "hard";
}

/** Movimiento de almacén: ajusta stock (+/-) y opcional costo. */
export async function moverStock(input: {
  insumoId: string;
  tipo: string;
  cantidad: number;
  costoPesos?: number | null;
}) {
  const supabase = createClient();
  const { data: row, error: e1 } = await supabase
    .from("insumos")
    .select("*")
    .eq("id", input.insumoId)
    .single();
  if (e1 || !row) throw new Error(e1?.message || "Insumo no encontrado");

  const qty = Math.abs(Number(input.cantidad) || 0);
  if (qty <= 0) throw new Error("Cantidad inválida");

  let next = Number(row.stock) || 0;
  if (input.tipo === "entrada" || input.tipo === "ajuste") next += qty;
  else next = Math.max(0, next - qty);

  const patch: {
    stock: number;
    updated_at: string;
    costo_unitario?: number;
  } = {
    stock: next,
    updated_at: new Date().toISOString(),
  };
  if (
    input.tipo === "entrada" &&
    input.costoPesos != null &&
    Number.isFinite(Number(input.costoPesos))
  ) {
    patch.costo_unitario = Math.round(Number(input.costoPesos) * 100);
  }

  const { data, error } = await supabase
    .from("insumos")
    .update(patch)
    .eq("id", input.insumoId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as InsumoRow;
}
