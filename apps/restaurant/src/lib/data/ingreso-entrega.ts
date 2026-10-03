import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Sb = SupabaseClient<Database>;

export type IngresoEntregaResult = {
  created: boolean;
  id: string | null;
  skipped?: boolean;
  error?: string;
};

function montoPedidoCentavos(p: {
  total?: number | null;
  subtotal?: number | null;
  costo_envio?: number | null;
}): number {
  const total = Math.round(Number(p.total) || 0);
  if (total > 0) return total;
  return Math.max(
    0,
    Math.round(Number(p.subtotal) || 0) + Math.round(Number(p.costo_envio) || 0)
  );
}

/**
 * Idempotente: un solo ingreso por pedido_id.
 * Monto = total (subtotal + envío; sin columna de descuento hoy).
 * No revierte el cambio de estado si falla.
 */
export async function ensureIngresoPedidoEntregado(
  supabase: Sb,
  pedido: {
    id: string;
    codigo: string;
    total?: number | null;
    subtotal?: number | null;
    costo_envio?: number | null;
    estado_pago?: string | null;
    metodo_pago?: string | null;
  },
  createdBy: string | null
): Promise<IngresoEntregaResult> {
  const { data: existing } = await supabase
    .from("ingresos")
    .select("id")
    .eq("pedido_id", pedido.id)
    .maybeSingle();
  if (existing?.id) return { created: false, id: existing.id };

  const monto = montoPedidoCentavos(pedido);
  if (monto <= 0) return { created: false, id: null, skipped: true };

  const metodo = String(pedido.metodo_pago || "sin_método").trim() || "sin_método";
  const estadoPago =
    String(pedido.estado_pago || "pendiente").trim() || "pendiente";

  const { data, error } = await supabase
    .from("ingresos")
    .insert({
      concepto: `Pedido ${pedido.codigo} · ${metodo} · pago ${estadoPago}`,
      monto,
      fuente: "ventas",
      pedido_id: pedido.id,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    // Carrera / segundo intento: unique parcial pedido_id
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("ingresos")
        .select("id")
        .eq("pedido_id", pedido.id)
        .maybeSingle();
      return { created: false, id: again?.id ?? null };
    }
    console.error("[finanzas:ingreso_pedido]", error);
    return { created: false, id: null, error: error.message };
  }

  return { created: true, id: data.id };
}

/**
 * Idempotente: un solo ingreso por reserva_id.
 * Monto = total de la reserva (incluye anticipo; no se registra anticipo aparte
 * para no duplicar en Finanzas).
 */
export async function ensureIngresoReservaEntregada(
  supabase: Sb,
  reserva: {
    id: string;
    codigo: string;
    total?: number | null;
    anticipo?: number | null;
    estado_anticipo?: string | null;
    metodo_pago?: string | null;
  },
  createdBy: string | null
): Promise<IngresoEntregaResult> {
  const { data: existing } = await supabase
    .from("ingresos")
    .select("id")
    .eq("reserva_id", reserva.id)
    .maybeSingle();
  if (existing?.id) return { created: false, id: existing.id };

  const monto = Math.round(Number(reserva.total) || 0);
  if (monto <= 0) return { created: false, id: null, skipped: true };

  const metodo = String(reserva.metodo_pago || "sin_método").trim() || "sin_método";
  const anticipo = Math.round(Number(reserva.anticipo) || 0);
  const estadoAnticipo =
    String(reserva.estado_anticipo || "pendiente").trim() || "pendiente";

  const { data, error } = await supabase
    .from("ingresos")
    .insert({
      concepto: `Reserva ${reserva.codigo} · ${metodo} · anticipo ${anticipo} (${estadoAnticipo})`,
      monto,
      fuente: "ventas",
      reserva_id: reserva.id,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("ingresos")
        .select("id")
        .eq("reserva_id", reserva.id)
        .maybeSingle();
      return { created: false, id: again?.id ?? null };
    }
    console.error("[finanzas:ingreso_reserva]", error);
    return { created: false, id: null, error: error.message };
  }

  return { created: true, id: data.id };
}
