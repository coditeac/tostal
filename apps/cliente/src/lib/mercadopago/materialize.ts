import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import {
  notificarPedidoCreadoAction,
  notificarReservaCreadaAction,
} from "@/app/actions/mail";
import type { MpEntidad } from "./external-ref";

export type CheckoutPendienteRow = {
  id: string;
  tipo: MpEntidad;
  payload: Json;
  monto_centavos: number;
  estado: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  entidad_id: string | null;
  codigo: string | null;
  cliente_email: string | null;
};

export type MaterializeResult =
  | {
      ok: true;
      already?: boolean;
      tipo: MpEntidad;
      entidadId: string;
      codigo: string;
    }
  | { ok: false; error: string };

/**
 * Crea pedido/reserva desde checkout_pendiente (solo tras MP approved).
 * Idempotente: si ya está convertido, devuelve la entidad existente.
 */
export async function materializeCheckoutFromPending(input: {
  checkoutId: string;
  paymentId?: string | null;
  preferenceId?: string | null;
  markPaid?: boolean;
}): Promise<MaterializeResult> {
  const admin = createServiceClient();
  if (!admin) {
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const { data: row, error: e0 } = await admin
    .from("checkout_pendiente")
    .select("*")
    .eq("id", input.checkoutId)
    .maybeSingle();

  if (e0 || !row) {
    return { ok: false, error: e0?.message || "Checkout no encontrado" };
  }

  const checkout = row as unknown as CheckoutPendienteRow;

  if (
    checkout.estado === "convertido" &&
    checkout.entidad_id &&
    checkout.codigo
  ) {
    if (input.markPaid !== false) {
      await markEntidadPagada(admin, checkout.tipo, checkout.entidad_id, {
        paymentId: input.paymentId,
        preferenceId: input.preferenceId || checkout.mp_preference_id,
      });
    }
    return {
      ok: true,
      already: true,
      tipo: checkout.tipo,
      entidadId: checkout.entidad_id,
      codigo: checkout.codigo,
    };
  }

  if (checkout.estado === "rechazado" || checkout.estado === "expirado") {
    return {
      ok: false,
      error: "Este checkout ya no se puede completar. Inicia uno nuevo.",
    };
  }

  const payload = {
    ...(checkout.payload as Record<string, unknown>),
    metodoPago: "mercadopago",
  };

  if (checkout.tipo === "pedido") {
    const { data, error } = await admin.rpc("crear_pedido_publico", {
      p_body: payload as unknown as Json,
    });
    if (error || !data) {
      return {
        ok: false,
        error: error?.message || "No se pudo crear el pedido",
      };
    }
    const pedido = (data as { pedido?: { id?: string; codigo?: string } })
      .pedido;
    const entidadId = String(pedido?.id || "");
    const codigo = String(pedido?.codigo || "");
    if (!entidadId || !codigo) {
      return { ok: false, error: "Respuesta de pedido incompleta" };
    }

    await markEntidadPagada(admin, "pedido", entidadId, {
      paymentId: input.paymentId,
      preferenceId: input.preferenceId || checkout.mp_preference_id,
    });

    await admin
      .from("checkout_pendiente")
      .update({
        estado: "convertido",
        entidad_id: entidadId,
        codigo,
        mp_payment_id: input.paymentId || null,
        mp_preference_id:
          input.preferenceId || checkout.mp_preference_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkout.id);

    const body = payload as {
      clienteEmail?: string | null;
      email?: string | null;
      clienteNombre?: string;
    };
    const email =
      checkout.cliente_email || body.clienteEmail || body.email || null;
    try {
      const p = (data as { pedido: Record<string, unknown> }).pedido;
      await notificarPedidoCreadoAction({
        pedido: {
          id: entidadId,
          codigo,
          clienteNombre: String(p.clienteNombre || body.clienteNombre || "Cliente"),
          fechaEntrega: String(p.fechaEntrega || ""),
          total: Number(p.total) || 0,
          estado: String(p.estado || "recibido"),
          modoEntrega: String(p.modoEntrega || "retiro"),
          canal: String(p.canal || "remoto"),
        },
        email,
      });
    } catch (e) {
      console.error("[mail:pedido_creado_mp]", e);
    }

    return { ok: true, tipo: "pedido", entidadId, codigo };
  }

  const { data, error } = await admin.rpc("crear_reserva_publica", {
    p_body: payload as unknown as Json,
  });
  if (error || !data) {
    return {
      ok: false,
      error: error?.message || "No se pudo crear la reserva",
    };
  }
  const reserva = (
    data as {
      reserva?: {
        id?: string;
        codigo?: string;
        anticipoMonto?: number;
        total?: number;
        fechaEntrega?: string;
        estado?: string;
        estadoAnticipo?: string;
      };
    }
  ).reserva;
  const entidadId = String(reserva?.id || "");
  const codigo = String(reserva?.codigo || "");
  if (!entidadId || !codigo) {
    return { ok: false, error: "Respuesta de reserva incompleta" };
  }

  await markEntidadPagada(admin, "reserva", entidadId, {
    paymentId: input.paymentId,
    preferenceId: input.preferenceId || checkout.mp_preference_id,
  });

  await admin
    .from("checkout_pendiente")
    .update({
      estado: "convertido",
      entidad_id: entidadId,
      codigo,
      mp_payment_id: input.paymentId || null,
      mp_preference_id:
        input.preferenceId || checkout.mp_preference_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkout.id);

  const body = payload as {
    clienteEmail?: string | null;
    email?: string | null;
    clienteNombre?: string;
    modoEntrega?: string;
  };
  try {
    await notificarReservaCreadaAction({
      reserva: {
        id: entidadId,
        codigo,
        clienteNombre: body.clienteNombre || "Cliente",
        fechaEntrega: String(reserva?.fechaEntrega || ""),
        total: Number(reserva?.total) || 0,
        anticipoMonto: Number(reserva?.anticipoMonto) || 0,
        estado: String(reserva?.estado || "recibido"),
        estadoAnticipo: "pagado",
        modoEntrega: body.modoEntrega || "retiro",
      },
      email: checkout.cliente_email || body.clienteEmail || body.email || null,
    });
  } catch (e) {
    console.error("[mail:reserva_creada_mp]", e);
  }

  return { ok: true, tipo: "reserva", entidadId, codigo };
}

async function markEntidadPagada(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tipo: MpEntidad,
  id: string,
  ids: { paymentId?: string | null; preferenceId?: string | null }
) {
  const now = new Date().toISOString();
  if (tipo === "pedido") {
    await admin
      .from("pedidos")
      .update({
        estado_pago: "pagado",
        ...(ids.paymentId ? { mp_payment_id: ids.paymentId } : {}),
        ...(ids.preferenceId ? { mp_preference_id: ids.preferenceId } : {}),
        updated_at: now,
      })
      .eq("id", id);
  } else {
    await admin
      .from("reservas")
      .update({
        estado_anticipo: "pagado",
        ...(ids.paymentId ? { mp_payment_id: ids.paymentId } : {}),
        ...(ids.preferenceId ? { mp_preference_id: ids.preferenceId } : {}),
        updated_at: now,
      })
      .eq("id", id);
  }
}

export async function markCheckoutRejected(input: {
  checkoutId: string;
  paymentId?: string | null;
  status?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };

  const { data: row } = await admin
    .from("checkout_pendiente")
    .select("id, estado")
    .eq("id", input.checkoutId)
    .maybeSingle();

  if (!row) return { ok: false, error: "Checkout no encontrado" };
  if (row.estado === "convertido") return { ok: true };

  const { error } = await admin
    .from("checkout_pendiente")
    .update({
      estado: "rechazado",
      mp_payment_id: input.paymentId || null,
      error_msg: input.status
        ? `Mercado Pago: ${input.status}`
        : "Pago no aprobado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.checkoutId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
