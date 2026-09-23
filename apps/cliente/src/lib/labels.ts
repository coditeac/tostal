import type {
  EstadoPago,
  EstadoPedido,
  MetodoPago,
  ModoEntrega,
} from "@tostal/shared/types";

export const ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  recibido: "Recibido",
  confirmado: "Confirmado",
  en_produccion: "En producción",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: "Pago pendiente",
  pagado: "Pagado",
  contra_entrega: "Se cobra al entregar",
  fallido: "Pago fallido",
  reembolsado: "Reembolsado",
};

export const METODO_PAGO: Record<MetodoPago, string> = {
  transferencia: "Transferencia",
  contra_entrega: "Contra entrega",
  stripe: "Tarjeta en línea",
  efectivo_mostrador: "Efectivo en caja",
};

export const MODO_ENTREGA: Record<ModoEntrega, string> = {
  retiro: "Retiro en tienda",
  envio: "Envío a domicilio",
};

export const PASOS_PEDIDO: EstadoPedido[] = [
  "recibido",
  "confirmado",
  "en_produccion",
  "listo",
  "entregado",
];
