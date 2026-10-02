"use server";

import {
  notifyPedidoCreado,
  notifyReservaCreada,
  type PedidoMail,
  type ReservaMail,
} from "@/lib/mail";

/**
 * Confirmación de pedido al cliente (+ staff si STAFF_NOTIFY_EMAIL).
 * Nunca lanza: el checkout no debe fallar por el correo.
 */
export async function notificarPedidoCreadoAction(input: {
  pedido: PedidoMail;
  email?: string | null;
}): Promise<{ ok: boolean; mock?: boolean; error?: string }> {
  try {
    await notifyPedidoCreado(input.pedido, input.email);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[mail:pedido_creado]", error);
    return { ok: false, error };
  }
}

/**
 * Confirmación de reserva al cliente (+ staff si STAFF_NOTIFY_EMAIL).
 */
export async function notificarReservaCreadaAction(input: {
  reserva: ReservaMail;
  email?: string | null;
}): Promise<{ ok: boolean; mock?: boolean; error?: string }> {
  try {
    await notifyReservaCreada(input.reserva, input.email);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[mail:reserva_creada]", error);
    return { ok: false, error };
  }
}
