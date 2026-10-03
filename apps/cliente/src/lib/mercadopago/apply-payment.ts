import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { MpEntidad } from "./external-ref";

export type ApplyPaymentResult = {
  ok: boolean;
  already?: boolean;
  error?: string;
};

function mapMpStatus(
  status: string
): "pagado" | "pendiente" | "fallido" | null {
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
      return "fallido";
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
    let row = (
      await admin
        .from("pedidos")
        .select("id, estado_pago")
        .eq("id", input.entidadId)
        .maybeSingle()
    ).data;
    if (!row) {
      row = (
        await admin
          .from("pedidos")
          .select("id, estado_pago")
          .eq("codigo", input.entidadId)
          .maybeSingle()
      ).data;
    }
    if (!row) return { ok: false, error: "Pedido no encontrado" };

    const shouldUpdateEstado =
      mapped === "pagado" ||
      (mapped === "fallido" && row.estado_pago !== "pagado");

    if (shouldUpdateEstado || input.preferenceId) {
      const { error } = await admin
        .from("pedidos")
        .update({
          mp_payment_id: input.paymentId,
          ...(input.preferenceId
            ? { mp_preference_id: input.preferenceId }
            : {}),
          ...(shouldUpdateEstado && mapped
            ? { estado_pago: mapped }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    let row = (
      await admin
        .from("reservas")
        .select("id, estado_anticipo")
        .eq("id", input.entidadId)
        .maybeSingle()
    ).data;
    if (!row) {
      row = (
        await admin
          .from("reservas")
          .select("id, estado_anticipo")
          .eq("codigo", input.entidadId)
          .maybeSingle()
      ).data;
    }
    if (!row) return { ok: false, error: "Reserva no encontrada" };

    const markPaid =
      mapped === "pagado" && row.estado_anticipo !== "pagado";

    const { error } = await admin
      .from("reservas")
      .update({
        mp_payment_id: input.paymentId,
        ...(input.preferenceId
          ? { mp_preference_id: input.preferenceId }
          : {}),
        ...(markPaid ? { estado_anticipo: "pagado" } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };
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
