"use server";

import { getSession } from "@/lib/session-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff marca transferencia (pedido) como verificada → estado_pago = pagado.
 */
export async function verificarPagoPedido(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "No autenticado" };

    const supabase = await createClient();
    const { data: prev, error: e0 } = await supabase
      .from("pedidos")
      .select("id, estado_pago, metodo_pago")
      .eq("id", id)
      .single();
    if (e0 || !prev) {
      return { ok: false, error: e0?.message || "Pedido no encontrado" };
    }

    if (prev.estado_pago === "pagado") return { ok: true };
    if (
      prev.estado_pago !== "pendiente_verificacion" &&
      prev.estado_pago !== "pendiente"
    ) {
      return {
        ok: false,
        error: `No se puede verificar un pago en estado «${prev.estado_pago}».`,
      };
    }

    const { error } = await supabase
      .from("pedidos")
      .update({
        estado_pago: "pagado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    await supabase.from("estado_historial").insert({
      entidad: "pedido",
      entidad_id: id,
      estado_anterior: prev.estado_pago,
      estado_nuevo: "pago_verificado",
      usuario_id: session.id,
      motivo: "Transferencia verificada por staff",
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo verificar el pago",
    };
  }
}

/**
 * Staff marca anticipo por transferencia como verificado → estado_anticipo = pagado.
 */
export async function verificarAnticipoReserva(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "No autenticado" };

    const supabase = await createClient();
    const { data: prev, error: e0 } = await supabase
      .from("reservas")
      .select("id, estado_anticipo, metodo_pago")
      .eq("id", id)
      .single();
    if (e0 || !prev) {
      return { ok: false, error: e0?.message || "Reserva no encontrada" };
    }

    if (prev.estado_anticipo === "pagado") return { ok: true };
    if (
      prev.estado_anticipo !== "pendiente_verificacion" &&
      prev.estado_anticipo !== "pendiente"
    ) {
      return {
        ok: false,
        error: `No se puede verificar un anticipo en estado «${prev.estado_anticipo}».`,
      };
    }

    const { error } = await supabase
      .from("reservas")
      .update({
        estado_anticipo: "pagado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    await supabase.from("estado_historial").insert({
      entidad: "reserva",
      entidad_id: id,
      estado_anterior: prev.estado_anticipo,
      estado_nuevo: "anticipo_verificado",
      usuario_id: session.id,
      motivo: "Anticipo por transferencia verificado por staff",
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "No se pudo verificar el anticipo",
    };
  }
}
