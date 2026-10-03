"use server";

import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { crearPreferenciaCheckoutPro } from "@/lib/mercadopago/preference";
import type { MpEntidad } from "@/lib/mercadopago/external-ref";
import { materializeCheckoutFromPending } from "@/lib/mercadopago/materialize";
import {
  notificarPedidoCreadoAction,
  notificarReservaCreadaAction,
} from "@/app/actions/mail";

export type CheckoutMpResult = {
  ok: boolean;
  mock?: boolean;
  checkoutUrl?: string | null;
  checkoutId?: string;
  codigo?: string;
  redirectPath?: string;
  message?: string;
  error?: string;
};

type CotizaPedido = {
  subtotal?: number;
  costoEnvio?: number;
  total?: number;
  fechaEntrega?: string;
};

type CotizaReserva = {
  subtotal?: number;
  anticipoMonto?: number;
  total?: number;
  fechaEntrega?: string;
};

/**
 * MP: guarda carrito en checkout_pendiente y crea Preference.
 * No crea pedido/reserva hasta webhook approved (o mock).
 */
export async function iniciarCheckoutPendiente(input: {
  tipo: MpEntidad;
  body: Record<string, unknown>;
}): Promise<CheckoutMpResult> {
  try {
    const admin = createServiceClient();
    if (!admin) {
      return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };
    }

    const payload: Record<string, unknown> = {
      ...input.body,
      metodoPago: "mercadopago",
    };

    const quoteRes =
      input.tipo === "pedido"
        ? await admin.rpc("cotizar_pedido_publico", {
            p_body: payload as unknown as Json,
          })
        : await admin.rpc("cotizar_reserva_publica", {
            p_body: payload as unknown as Json,
          });
    const quoteRaw = quoteRes.data;
    const quoteErr = quoteRes.error;
    if (quoteErr || !quoteRaw) {
      return {
        ok: false,
        error: quoteErr?.message || "No se pudo cotizar el checkout",
      };
    }

    const quote = quoteRaw as CotizaPedido & CotizaReserva;
    const montoCentavos =
      input.tipo === "pedido"
        ? Math.round(Number(quote.total) || 0)
        : Math.round(Number(quote.anticipoMonto) || 0);

    if (montoCentavos < 1) {
      return {
        ok: false,
        error:
          input.tipo === "reserva"
            ? "El anticipo calculado no es válido."
            : "El total del pedido no es válido.",
      };
    }

    const email =
      (typeof payload.clienteEmail === "string" && payload.clienteEmail) ||
      (typeof payload.email === "string" && payload.email) ||
      null;
    const nombre =
      typeof payload.clienteNombre === "string"
        ? payload.clienteNombre
        : null;

    const { data: inserted, error: insErr } = await admin
      .from("checkout_pendiente")
      .insert({
        tipo: input.tipo,
        payload: payload as unknown as Json,
        monto_centavos: montoCentavos,
        cliente_email: email,
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return {
        ok: false,
        error: insErr?.message || "No se pudo crear el checkout pendiente",
      };
    }

    const checkoutId = String(inserted.id);
    const titulo =
      input.tipo === "pedido"
        ? `Pedido Tostal (pago pendiente)`
        : `Anticipo reserva Tostal`;

    const pref = await crearPreferenciaCheckoutPro({
      tipo: "checkout",
      id: checkoutId,
      codigo: checkoutId.slice(0, 8).toUpperCase(),
      montoCentavos,
      titulo,
      payerEmail: email,
      payerNombre: nombre,
      checkoutTipo: input.tipo,
    });

    if (!pref.ok) {
      await admin
        .from("checkout_pendiente")
        .update({
          estado: "rechazado",
          error_msg: pref.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkoutId);
      return { ok: false, error: pref.error, checkoutId };
    }

    if (pref.preferenceId) {
      await admin
        .from("checkout_pendiente")
        .update({
          mp_preference_id: pref.preferenceId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkoutId);
    }

    if (pref.mock) {
      const created = await materializeCheckoutFromPending({
        checkoutId,
        paymentId: `mock_chk_${Date.now()}`,
        preferenceId: "mock",
        markPaid: true,
      });
      if (!created.ok) {
        return {
          ok: false,
          mock: true,
          checkoutId,
          error: created.error || "No se pudo simular el pago",
        };
      }
      const path =
        created.tipo === "pedido"
          ? `/pedido/${created.codigo}?pago=mock`
          : `/reserva/${created.codigo}?pago=mock`;
      return {
        ok: true,
        mock: true,
        checkoutId,
        codigo: created.codigo,
        checkoutUrl: null,
        redirectPath: path,
        message: pref.message,
      };
    }

    return {
      ok: true,
      mock: false,
      checkoutId,
      checkoutUrl: pref.checkoutUrl,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[mp:checkout_pendiente]", error);
    return { ok: false, error };
  }
}

/** Reintenta Preference MP sobre un checkout pendiente/rechazado. */
export async function reintentarCheckoutMercadoPago(
  checkoutId: string
): Promise<CheckoutMpResult> {
  try {
    const admin = createServiceClient();
    if (!admin) {
      return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };
    }

    const { data: row, error } = await admin
      .from("checkout_pendiente")
      .select("*")
      .eq("id", checkoutId)
      .maybeSingle();
    if (error || !row) {
      return { ok: false, error: error?.message || "Checkout no encontrado" };
    }
    if (row.estado === "convertido" && row.codigo) {
      const path =
        row.tipo === "pedido"
          ? `/pedido/${row.codigo}`
          : `/reserva/${row.codigo}`;
      return {
        ok: true,
        checkoutId,
        codigo: row.codigo,
        redirectPath: path,
        message: "Este pago ya se confirmó.",
      };
    }

    const payload = row.payload as Record<string, unknown>;
    const email =
      row.cliente_email ||
      (typeof payload.clienteEmail === "string"
        ? payload.clienteEmail
        : null);
    const nombre =
      typeof payload.clienteNombre === "string"
        ? payload.clienteNombre
        : null;

    await admin
      .from("checkout_pendiente")
      .update({
        estado: "pendiente",
        error_msg: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkoutId);

    const pref = await crearPreferenciaCheckoutPro({
      tipo: "checkout",
      id: checkoutId,
      codigo: checkoutId.slice(0, 8).toUpperCase(),
      montoCentavos: Math.round(Number(row.monto_centavos) || 0),
      titulo:
        row.tipo === "pedido"
          ? "Pedido Tostal (reintento)"
          : "Anticipo reserva Tostal (reintento)",
      payerEmail: email,
      payerNombre: nombre,
      checkoutTipo: row.tipo as MpEntidad,
    });

    if (!pref.ok) return { ok: false, error: pref.error, checkoutId };

    if (pref.mock) {
      const created = await materializeCheckoutFromPending({
        checkoutId,
        paymentId: `mock_chk_${Date.now()}`,
        preferenceId: "mock",
        markPaid: true,
      });
      if (!created.ok) {
        return { ok: false, mock: true, error: created.error, checkoutId };
      }
      const path =
        created.tipo === "pedido"
          ? `/pedido/${created.codigo}?pago=mock`
          : `/reserva/${created.codigo}?pago=mock`;
      return {
        ok: true,
        mock: true,
        checkoutId,
        codigo: created.codigo,
        redirectPath: path,
      };
    }

    if (pref.preferenceId) {
      await admin
        .from("checkout_pendiente")
        .update({
          mp_preference_id: pref.preferenceId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkoutId);
    }

    return {
      ok: true,
      checkoutId,
      checkoutUrl: pref.checkoutUrl,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}

/**
 * Tras fallo MP: crea pedido/reserva con transferencia o contra entrega
 * usando el payload del checkout pendiente.
 */
export async function confirmarCheckoutMetodoAlternativo(input: {
  checkoutId: string;
  metodoPago: "transferencia" | "contra_entrega";
}): Promise<CheckoutMpResult> {
  try {
    const admin = createServiceClient();
    if (!admin) {
      return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };
    }

    const { data: row, error } = await admin
      .from("checkout_pendiente")
      .select("*")
      .eq("id", input.checkoutId)
      .maybeSingle();
    if (error || !row) {
      return { ok: false, error: error?.message || "Checkout no encontrado" };
    }
    if (row.estado === "convertido" && row.codigo) {
      const path =
        row.tipo === "pedido"
          ? `/pedido/${row.codigo}`
          : `/reserva/${row.codigo}`;
      return {
        ok: true,
        checkoutId: input.checkoutId,
        codigo: row.codigo,
        redirectPath: path,
      };
    }

    if (row.tipo === "reserva" && input.metodoPago === "contra_entrega") {
      return {
        ok: false,
        error: "Las reservas no admiten pago contra entrega.",
        checkoutId: input.checkoutId,
      };
    }

    const payload: Record<string, unknown> = {
      ...(row.payload as Record<string, unknown>),
      metodoPago: input.metodoPago,
    };

    if (row.tipo === "pedido") {
      const { data, error: rpcErr } = await admin.rpc("crear_pedido_publico", {
        p_body: payload as unknown as Json,
      });
      if (rpcErr || !data) {
        return {
          ok: false,
          error: rpcErr?.message || "No se pudo crear el pedido",
          checkoutId: input.checkoutId,
        };
      }
      const pedido = (
        data as {
          pedido: {
            id: string;
            codigo: string;
            clienteNombre?: string;
            fechaEntrega?: string;
            total?: number;
            estado?: string;
            modoEntrega?: string;
            canal?: string;
          };
        }
      ).pedido;
      await admin
        .from("checkout_pendiente")
        .update({
          estado: "convertido",
          entidad_id: pedido.id,
          codigo: pedido.codigo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.checkoutId);

      try {
        await notificarPedidoCreadoAction({
          pedido: {
            id: pedido.id,
            codigo: pedido.codigo,
            clienteNombre: String(
              pedido.clienteNombre || payload.clienteNombre || "Cliente"
            ),
            fechaEntrega: String(pedido.fechaEntrega || ""),
            total: Number(pedido.total) || 0,
            estado: String(pedido.estado || "recibido"),
            modoEntrega: String(pedido.modoEntrega || "retiro"),
            canal: String(pedido.canal || "remoto"),
          },
          email:
            row.cliente_email ||
            (typeof payload.clienteEmail === "string"
              ? payload.clienteEmail
              : null),
        });
      } catch (e) {
        console.error("[mail:pedido_alt]", e);
      }

      return {
        ok: true,
        checkoutId: input.checkoutId,
        codigo: pedido.codigo,
        redirectPath: `/pedido/${pedido.codigo}`,
      };
    }

    const { data, error: rpcErr } = await admin.rpc("crear_reserva_publica", {
      p_body: payload as unknown as Json,
    });
    if (rpcErr || !data) {
      return {
        ok: false,
        error: rpcErr?.message || "No se pudo crear la reserva",
        checkoutId: input.checkoutId,
      };
    }
    const reserva = (
      data as {
        reserva: {
          id: string;
          codigo: string;
          fechaEntrega?: string;
          total?: number;
          anticipoMonto?: number;
          estado?: string;
          estadoAnticipo?: string;
        };
      }
    ).reserva;
    await admin
      .from("checkout_pendiente")
      .update({
        estado: "convertido",
        entidad_id: reserva.id,
        codigo: reserva.codigo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.checkoutId);

    try {
      await notificarReservaCreadaAction({
        reserva: {
          id: reserva.id,
          codigo: reserva.codigo,
          clienteNombre: String(payload.clienteNombre || "Cliente"),
          fechaEntrega: String(reserva.fechaEntrega || ""),
          total: Number(reserva.total) || 0,
          anticipoMonto: Number(reserva.anticipoMonto) || 0,
          estado: String(reserva.estado || "recibido"),
          estadoAnticipo: String(
            reserva.estadoAnticipo || "pendiente_verificacion"
          ),
          modoEntrega: String(payload.modoEntrega || "retiro"),
        },
        email:
          row.cliente_email ||
          (typeof payload.clienteEmail === "string"
            ? payload.clienteEmail
            : null),
      });
    } catch (e) {
      console.error("[mail:reserva_alt]", e);
    }

    return {
      ok: true,
      checkoutId: input.checkoutId,
      codigo: reserva.codigo,
      redirectPath: `/reserva/${reserva.codigo}`,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}

export async function getCheckoutPendientePublico(checkoutId: string): Promise<
  | {
      ok: true;
      checkout: {
        id: string;
        tipo: MpEntidad;
        estado: string;
        montoCentavos: number;
        codigo: string | null;
        errorMsg: string | null;
        entidadId: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" };

  const { data, error } = await admin
    .from("checkout_pendiente")
    .select(
      "id, tipo, estado, monto_centavos, codigo, error_msg, entidad_id"
    )
    .eq("id", checkoutId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message || "Checkout no encontrado" };
  }

  return {
    ok: true,
    checkout: {
      id: data.id,
      tipo: data.tipo as MpEntidad,
      estado: data.estado,
      montoCentavos: Math.round(Number(data.monto_centavos) || 0),
      codigo: data.codigo,
      errorMsg: data.error_msg,
      entidadId: data.entidad_id,
    },
  };
}
