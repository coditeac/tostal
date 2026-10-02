"use client";

import type { InsumoNecesario, ReservaCola } from "@/lib/reservas-types";
import type { EstadoFlujo } from "@/lib/estados";
import { createClient } from "@/lib/supabase/client";

export type { InsumoNecesario, ReservaCola };

async function explodeInsumos(
  items: Array<{ producto_id: string | null; cantidad: number; nombre: string }>
): Promise<InsumoNecesario[]> {
  const supabase = createClient();
  const productoIds = [
    ...new Set(items.map((i) => i.producto_id).filter(Boolean) as string[]),
  ];
  if (!productoIds.length) return [];

  const [{ data: productos }, { data: recetas }, { data: insumos }] =
    await Promise.all([
      supabase
        .from("productos")
        .select("id, receta_rendimiento")
        .in("id", productoIds),
      supabase
        .from("producto_insumos")
        .select("producto_id, insumo_id, cantidad_lote")
        .in("producto_id", productoIds),
      supabase.from("insumos").select("id, nombre, unidad, stock"),
    ]);

  const rend = new Map(
    (productos || []).map((p) => [
      p.id,
      Math.max(1, Number(p.receta_rendimiento) || 1),
    ])
  );
  const stockMap = new Map(
    (insumos || []).map((i) => [
      i.id,
      {
        nombre: i.nombre,
        unidad: i.unidad,
        stock: Number(i.stock) || 0,
      },
    ])
  );

  const needed = new Map<string, number>();
  for (const item of items) {
    if (!item.producto_id) continue;
    const r = rend.get(item.producto_id) || 1;
    const lines = (recetas || []).filter(
      (x) => x.producto_id === item.producto_id
    );
    for (const line of lines) {
      const qty =
        (Number(item.cantidad) * Number(line.cantidad_lote)) / r;
      const prev = needed.get(line.insumo_id) || 0;
      const unidad = stockMap.get(line.insumo_id)?.unidad || "u";
      const add = unidad === "u" ? Math.ceil(qty) : qty;
      needed.set(line.insumo_id, prev + add);
    }
  }

  const result: InsumoNecesario[] = [];
  for (const [insumoId, cantidadNecesaria] of needed) {
    const info = stockMap.get(insumoId);
    const stockActual = info?.stock ?? 0;
    const faltante = Math.max(0, cantidadNecesaria - stockActual);
    result.push({
      insumoId,
      nombre: info?.nombre || "Insumo",
      unidad: info?.unidad || "u",
      cantidadNecesaria,
      stockActual,
      faltante,
      requiereCompra: faltante > 0,
    });
  }
  return result;
}

export async function listReservasCola(): Promise<ReservaCola[]> {
  const supabase = createClient();
  const { data: reservas, error } = await supabase
    .from("reservas")
    .select("*")
    .order("fecha_reserva", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  if (!reservas?.length) return [];

  const ids = reservas.map((r) => r.id);
  const { data: items, error: e2 } = await supabase
    .from("reserva_items")
    .select("*")
    .in("reserva_id", ids);
  if (e2) throw new Error(e2.message);

  const byReserva = new Map<string, typeof items>();
  for (const it of items || []) {
    const list = byReserva.get(it.reserva_id) || [];
    list.push(it);
    byReserva.set(it.reserva_id, list);
  }

  const out: ReservaCola[] = [];
  for (const r of reservas) {
    const lineas = byReserva.get(r.id) || [];
    const insumos = await explodeInsumos(
      lineas.map((l) => ({
        producto_id: l.producto_id,
        cantidad: Number(l.cantidad) || 0,
        nombre: l.nombre,
      }))
    );
    const requiereCompra = insumos.some((i) => i.requiereCompra);
    out.push({
      id: r.id,
      codigo: r.codigo,
      fecha: r.fecha_reserva,
      estado: r.estado,
      clienteNombre: r.cliente_nombre || "Cliente",
      clienteTelefono: null,
      anticipo: Number(r.anticipo) || 0,
      total: Number(r.total) || 0,
      requiereCompra,
      productos: lineas.map((l) => ({
        productoId: l.producto_id || "",
        nombre: l.nombre,
        cantidad: Number(l.cantidad) || 0,
      })),
      insumosNecesarios: insumos,
      sugerenciasCompra: insumos
        .filter((i) => i.requiereCompra)
        .map((i) => `${i.nombre}: faltan ${i.faltante}${i.unidad}`),
    });
  }
  return out;
}

export async function updateReservaEstado(
  id: string,
  estado: EstadoFlujo,
  motivo?: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prev, error: e0 } = await supabase
    .from("reservas")
    .select("*")
    .eq("id", id)
    .single();
  if (e0 || !prev) throw new Error(e0?.message || "Reserva no encontrada");

  const { data, error } = await supabase
    .from("reservas")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("estado_historial").insert({
    entidad: "reserva",
    entidad_id: id,
    estado_anterior: prev.estado,
    estado_nuevo: estado,
    usuario_id: user?.id ?? null,
    motivo: motivo ?? null,
  });

  return data;
}
