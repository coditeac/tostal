import type {
  EstadoPago,
  MetodoPago,
  ModoEntrega,
} from "@tostal/shared/types";
import {
  ESTADO_SEGUIMIENTO_LABEL,
  labelEstado,
  pasosTimeline,
  type EstadoSeguimiento,
} from "@/lib/estados";

/** @deprecated Preferir labelEstado / ESTADO_SEGUIMIENTO_LABEL — compat legacy. */
export const ESTADO_PEDIDO: Record<string, string> = {
  ...ESTADO_SEGUIMIENTO_LABEL,
  // aliases legacy visibles si llegan crudos
  confirmado: "Aceptado",
  en_produccion: "Preparando",
};

export { labelEstado, ESTADO_SEGUIMIENTO_LABEL };

export const ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: "Pago pendiente",
  pendiente_verificacion: "Pendiente de verificación",
  pagado: "Pagado",
  contra_entrega: "Se cobra al entregar",
  fallido: "Pago fallido",
  rechazado: "Pago rechazado",
  reembolsado: "Reembolsado",
};

export const METODO_PAGO: Record<MetodoPago, string> = {
  transferencia: "Transferencia",
  contra_entrega: "Contra entrega",
  mercadopago: "Tarjeta / Mercado Pago",
  stripe: "Tarjeta / Mercado Pago",
  efectivo_mostrador: "Efectivo en caja",
};

export const MODO_ENTREGA: Record<ModoEntrega, string> = {
  retiro: "Retiro en tienda",
  envio: "Envío a domicilio",
};

/** Pasos default (retiro). Para envío usar pasosTimeline("envio"). */
export const PASOS_PEDIDO: EstadoSeguimiento[] = pasosTimeline("retiro");

export const ESTADO_RESERVA_LABEL: Record<string, string> = {
  ...ESTADO_SEGUIMIENTO_LABEL,
  pendiente_anticipo: "Recibido",
  confirmada: "Aceptado",
  en_produccion: "Preparando",
  lista: "Listo",
  entregada: "Entregado",
  cancelada: "Cancelado",
};

export const ESTADO_ANTICIPO: Record<string, string> = {
  pendiente: "Anticipo pendiente",
  pendiente_verificacion: "Anticipo pendiente de verificación",
  pagado: "Anticipo pagado",
  fallido: "Anticipo fallido",
  rechazado: "Anticipo rechazado",
  reembolsado: "Anticipo reembolsado",
};
