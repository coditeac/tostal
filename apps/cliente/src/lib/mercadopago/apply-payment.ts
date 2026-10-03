import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { MpEntidad } from "./external-ref";

export type ApplyPaymentResult = {
  ok: boolean;
  already?: boolean;
  error?: string;
};

function mapMpStatus(status: string): "pagado" | "pendiente" | "fallido" | null {
  switch (status) {
    case "approved":
      return "pagado";
    case "pending":
    case "in_process":
    case "authorized":
      return "pendiente";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return status === "refunded" || status === "charged_back"
        ? "fallido"
        : "fallido";
    default:
      return null;
  }
}

/**
 * Aplica estado de pago MP a pedido/reserva. Idempotente por payment_id.
 */
export async function applyMpPaymentStatus(input: {
  tipo: MpEntidad;
  entidadId: string;
  paymentId: string;
  status: string;
  externalReference: string;
  topic?: string | null;
  action?: string | null;
  payload?: unknown;
  preferenceId?: string | null;
}): Promise<ApplyPaymentResult> {
  const admin = createServiceClient();
  if (!admin) {
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const { data: existing } = await admin
    .from("mp_webhook_events")
    .select("payment_id, status")
    .eq("payment_id", input.paymentId)
    .maybeSingle();

  if (existing && existing.status === input.status) {
    return { ok: true, already: true };
  }

  const mapped = mapMpStatus(input.status);

  if (input.tipo === "pedido") {
    const patch: Record<string, unknown> = {
      mp_payment_id: input.paymentId,
      updated_at: new Date().toISOString(),
    };
    if (input.preferenceId) patch.mp_preference_id = input.preferenceId;
    if (mapped === "pagado") patch.estado_pago = "pagado";
    else if (mapped === "fallido") patch.estado_pago = "fallido";
    // pendiente: no pisar si ya estaba pagado
    if (mapped === "pagado" || mapped === "fallido") {
      const { data: row } = await admin
        .from("pedidos")
        .select("id, estado_pago")
        .eq("id", input.entidadId)
        .maybeSingle();
      if (!row) {
        // intentar por codigo si external usó uuid limpio raro
        const { data: byCode } = await admin
          .from("pedidos")
          .select("id, estado_pago")
          .eq("codigo", input.entidadId)
          .maybeSingle();
        if (!byCode) {
          return { ok: false, error: "Pedido no encontrado" };
        }
        if (byCode.estado_pago === "pagado" && mapped !== "pagado") {
          // no degradar
        } else {
          await admin.from("pedidos").update(patch).eq("id", byCode.id);
        }
      } else if (!(row.estado_pago === "pagado" && mapped !== "pagado")) {
        await admin.from("pedidos").update(patch).eq("id", row.id);
      }
    } else if (input.preferenceId) {
      await admin
        .from("pedidos")
        .update({
          mp_preference_id: input.preferenceId,
          mp_payment_id: input.paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.entidadId);
    }
  } else {
    const patch: Record<string, unknown> = {
      mp_payment_id: input.paymentId,
      updated_at: new Date().toISOString(),
    };
    if (input.preferenceId) patch.mp_preference_id = input.preferenceId;
    if (mapped === "pagado") patch.estado_anticipo = "pagado";
    else if (mapped === "fallido") {
      // mantener pendiente si falló; staff puede reintentar
    }

    const { data: row } = await admin
      .from("reservas")
      .select("id, estado_anticipo")
      .eq("id", input.entidadId)
      .maybeSingle();

    if (!row) {
      const { data: byCode } = await admin
        .from("reservas")
        .select("id, estado_anticipo")
        .eq("codigo", input.entidadId)
        .maybeSingle();
      if (!byCode) return { ok: false, error: "Reserva no encontrada" };
      if (!(byCode.estado_anticipo === "pagado" && mapped !== "pagado")) {
        await admin.from("reservas").update(patch).eq("id", byCode.id);
      }
    } else if (!(row.estado_anticipo === "pagado" && mapped !== "pagado")) {
      await admin.from("reservas").update(patch).eq("id", row.id);
    }
  }

  await admin.from("mp_webhook_events").upsert(
    {
      payment_id: input.paymentId,
      topic: input.topic || "payment",
      external_reference: input.externalReference,
      status: input.status,
      action: input.action,
      payload: (input.payload as Json) ?? null,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "payment_id" }
  );

  return { ok: true };
}

/** Marca pagado en mock (sin llamar a MP). */
export async function markPaidMock(input: {
  tipo: MpEntidad;
  id: string;
  preferenceId?: string | null;
}): Promise<ApplyPaymentResult> {
  const admin = createServiceClient();
  if (!admin) {
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };
  }
  const mockPaymentId = `mock_${input.tipo}_${Date.now()}`;
  if (input.tipo === "pedido") {
    const { error } = await admin
      .from("pedidos")
      .update({
        estado_pago: "pagado",
        mp_preference_id: input.preferenceId || "mock",
        mp_payment_id: mockPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("reservas")
      .update({
        estado_anticipo: "pagado",
        mp_preference_id: input.preferenceId || "mock",
        mp_payment_id: mockPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  }

  await admin.from("mp_webhook_events").upsert(
    {
      payment_id: mockPaymentId,
      topic: "mock",
      external_reference: `${input.tipo}_${input.id}`,
      status: "approved",
      action: "mock.approved",
      payload: { mock: true },
      processed_at: new Date().toISOString(),
    },
    { onConflict: "payment_id" }
  );

  return { ok: true };
}
