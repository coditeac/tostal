"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { markPaidMock } from "@/lib/mercadopago/apply-payment";
import { crearPreferenciaCheckoutPro } from "@/lib/mercadopago/preference";
import type { MpEntidad } from "@/lib/mercadopago/external-ref";

export type CheckoutMpResult = {
  ok: boolean;
  mock?: boolean;
  checkoutUrl?: string | null;
  message?: string;
  error?: string;
};

/**
 * Crea preferencia Checkout Pro tras alta de pedido/reserva.
 * Sin MP_ACCESS_TOKEN → mock: marca pagado y no redirige.
 */
export async function iniciarCheckoutMercadoPago(input: {
  tipo: MpEntidad;
  id: string;
  codigo: string;
  montoCentavos: number;
  payerEmail?: string | null;
  payerNombre?: string | null;
}): Promise<CheckoutMpResult> {
  try {
    const titulo =
      input.tipo === "pedido"
        ? `Pedido Tostal ${input.codigo}`
        : `Anticipo reserva Tostal ${input.codigo}`;

    const pref = await crearPreferenciaCheckoutPro({
      tipo: input.tipo,
      id: input.id,
      codigo: input.codigo,
      montoCentavos: input.montoCentavos,
      titulo,
      payerEmail: input.payerEmail,
      payerNombre: input.payerNombre,
    });

    if (!pref.ok) {
      return { ok: false, error: pref.error };
    }

    const admin = createServiceClient();
    if (admin && pref.preferenceId) {
      const table = input.tipo === "pedido" ? "pedidos" : "reservas";
      await admin
        .from(table)
        .update({
          mp_preference_id: pref.preferenceId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
    }

    if (pref.mock) {
      const marked = await markPaidMock({
        tipo: input.tipo,
        id: input.id,
        preferenceId: "mock",
      });
      if (!marked.ok) {
        return {
          ok: false,
          mock: true,
          error: marked.error || "No se pudo simular el pago",
        };
      }
      return {
        ok: true,
        mock: true,
        checkoutUrl: null,
        message: pref.message,
      };
    }

    return {
      ok: true,
      mock: false,
      checkoutUrl: pref.checkoutUrl,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[mp:checkout]", error);
    return { ok: false, error };
  }
}
