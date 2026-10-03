"use client";

import { createClient } from "@/lib/supabase/client";
import type { InsumoRow } from "./insumos";

export type ProductoRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  imagen_url: string | null;
  activo: boolean;
  reserva_habilitada: boolean;
  reserva_dias_minimos: number;
  reserva_cantidad_minima: number;
  anticipo_tipo: string;
  anticipo_valor: number;
  receta_rendimiento: number;
};

export type RecetaLinea = {
  id: string;
  producto_id: string;
  insumo_id: string;
  cantidad_lote: number;
  insumos?: Pick<InsumoRow, "id" | "nombre" | "unidad" | "costo_unitario"> | null;
};

function costoCalculado(
  rendimiento: number,
  lineas: RecetaLinea[]
): number {
  const r = Math.max(1, rendimiento || 1);
  return lineas.reduce((sum, l) => {
    const costo = Number(l.insumos?.costo_unitario ?? 0);
    return sum + (Number(l.cantidad_lote) / r) * costo;
  }, 0);
}

export async function listProductosConReceta(opts?: {
  /** Por defecto solo activos (excluye soft-delete). */
  incluirInactivos?: boolean;
}) {
  const supabase = createClient();
  let productosQ = supabase.from("productos").select("*").order("nombre");
  if (!opts?.incluirInactivos) {
    productosQ = productosQ.eq("activo", true);
  }
  const [{ data: productos, error: e1 }, { data: recetas, error: e2 }] =
    await Promise.all([
      productosQ,
      supabase
        .from("producto_insumos")
        .select("*, insumos(id, nombre, unidad, costo_unitario)"),
    ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const byProd = new Map<string, RecetaLinea[]>();
  for (const r of (recetas || []) as RecetaLinea[]) {
    const list = byProd.get(r.producto_id) || [];
    list.push(r);
    byProd.set(r.producto_id, list);
  }

  return ((productos || []) as ProductoRow[]).map((p) => {
    const receta = byProd.get(p.id) || [];
    const rendimiento = Math.max(1, Number(p.receta_rendimiento) || 1);
    const costo = Math.round(costoCalculado(rendimiento, receta));
    return {
      ...p,
      precio: Number(p.precio_venta) || 0,
      precio_venta: Number(p.precio_venta) || 0,
      foto_url: p.imagen_url,
      fotoUrl: p.imagen_url,
      imagen_url: p.imagen_url,
      imagenUrl: p.imagen_url,
      activoCatalogo: p.activo,
      costoCalculado: costo,
      costo_calculado: costo,
      costoTeorico: costo,
      recetaRendimiento: rendimiento,
      receta_rendimiento: rendimiento,
      reservaHabilitada: p.reserva_habilitada,
      reserva_habilitada: p.reserva_habilitada,
      anticipoTipo: p.anticipo_tipo as "porcentaje" | "monto",
      anticipo_tipo: p.anticipo_tipo,
      anticipoValor: Number(p.anticipo_valor) || 0,
      anticipo_valor: Number(p.anticipo_valor) || 0,
      reservaDiasMinimos: p.reserva_dias_minimos,
      reserva_dias_minimos: p.reserva_dias_minimos,
      reservaCantidadMinima: p.reserva_cantidad_minima,
      reserva_cantidad_minima: p.reserva_cantidad_minima,
      receta: receta.map((r) => ({
        id: r.id,
        insumoId: r.insumo_id,
        insumo_id: r.insumo_id,
        cantidad: Number(r.cantidad_lote),
        cantidad_lote: Number(r.cantidad_lote),
        porPieza: Number(r.cantidad_lote) / rendimiento,
        por_pieza: Number(r.cantidad_lote) / rendimiento,
        insumoNombre: r.insumos?.nombre,
        insumo_nombre: r.insumos?.nombre,
        unidad: r.insumos?.unidad,
      })),
    };
  });
}

export async function upsertProducto(input: {
  id?: string;
  nombre: string;
  descripcion?: string | null;
  precio_venta: number;
  activo?: boolean;
  reserva_habilitada?: boolean;
  anticipo_tipo?: string;
  anticipo_valor?: number;
  reserva_dias_minimos?: number;
  reserva_cantidad_minima?: number;
  receta_rendimiento?: number;
  receta: Array<{ insumoId: string; cantidad: number }>;
  imagen_url?: string | null;
}) {
  const supabase = createClient();
  const payload = {
    nombre: input.nombre,
    descripcion: input.descripcion ?? null,
    precio_venta: input.precio_venta,
    activo: input.activo ?? true,
    reserva_habilitada: input.reserva_habilitada ?? false,
    anticipo_tipo: input.anticipo_tipo ?? "porcentaje",
    anticipo_valor: input.anticipo_valor ?? 0,
    reserva_dias_minimos: input.reserva_dias_minimos ?? 3,
    reserva_cantidad_minima: input.reserva_cantidad_minima ?? 1,
    receta_rendimiento: Math.max(1, input.receta_rendimiento ?? 1),
    imagen_url: input.imagen_url ?? undefined,
    updated_at: new Date().toISOString(),
  };

  let productoId = input.id;
  if (productoId) {
    const { error } = await supabase
      .from("productos")
      .update(payload)
      .eq("id", productoId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("productos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    productoId = data.id;
  }

  await supabase.from("producto_insumos").delete().eq("producto_id", productoId);
  const lineas = input.receta
    .filter((r) => r.insumoId && Number(r.cantidad) > 0)
    .map((r) => ({
      producto_id: productoId!,
      insumo_id: r.insumoId,
      cantidad_lote: Number(r.cantidad),
    }));
  if (lineas.length) {
    const { error } = await supabase.from("producto_insumos").insert(lineas);
    if (error) throw new Error(error.message);
  }
  return productoId!;
}

/**
 * Soft-delete: oculta del catálogo y del menú del día.
 * Conserva historial de pedidos/reservas (FK sin CASCADE hacia items).
 */
export async function deleteProducto(id: string): Promise<"soft"> {
  const supabase = createClient();
  const { error } = await supabase
    .from("productos")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase
    .from("menu_dia_productos")
    .update({ activo: false })
    .eq("producto_id", id);

  return "soft";
}
