/**
 * Bus de eventos en memoria para SSE de pedidos y reservaciones.
 * Suficiente con 1 réplica Railway (tostal-api).
 */
import type { PedidoPublico } from "../../../../shared/types";
import type { ReservaPublica } from "./domain-types";

export type PedidoEventType =
  | "pedido_creado"
  | "estado_cambiado"
  | "pago_confirmado"
  | "listo"
  | "entregado";

export type ReservaEventType =
  | "reserva_creada"
  | "estado_cambiado"
  | "anticipo_confirmado"
  | "listo"
  | "entregado";

export type PedidoEvent = {
  type: PedidoEventType;
  at: string;
  pedido: PedidoPublico;
};

export type ReservaEvent = {
  type: ReservaEventType;
  at: string;
  reserva: ReservaPublica;
};

type PedidoListener = (event: PedidoEvent) => void;
type ReservaListener = (event: ReservaEvent) => void;

const pedidoKey = "__tostal_pedido_bus__";
const reservaKey = "__tostal_reserva_bus__";

type PedidoBus = {
  listeners: Set<PedidoListener>;
  recent: PedidoEvent[];
};

type ReservaBus = {
  listeners: Set<ReservaListener>;
  recent: ReservaEvent[];
};

function pedidoBus(): PedidoBus {
  const g = globalThis as unknown as Record<string, PedidoBus | undefined>;
  if (!g[pedidoKey]) {
    g[pedidoKey] = { listeners: new Set(), recent: [] };
  }
  return g[pedidoKey]!;
}

function reservaBus(): ReservaBus {
  const g = globalThis as unknown as Record<string, ReservaBus | undefined>;
  if (!g[reservaKey]) {
    g[reservaKey] = { listeners: new Set(), recent: [] };
  }
  return g[reservaKey]!;
}

export function publishPedidoEvent(
  type: PedidoEventType,
  pedido: PedidoPublico
): PedidoEvent {
  let resolved: PedidoEventType = type;
  if (type === "estado_cambiado") {
    if (pedido.estado === "listo") resolved = "listo";
    else if (pedido.estado === "entregado") resolved = "entregado";
  }
  const event: PedidoEvent = {
    type: resolved,
    at: new Date().toISOString(),
    pedido,
  };
  const b = pedidoBus();
  b.recent.push(event);
  if (b.recent.length > 50) b.recent.shift();
  for (const l of b.listeners) {
    try {
      l(event);
    } catch {
      /* listener roto */
    }
  }
  return event;
}

export function subscribePedidos(listener: PedidoListener): () => void {
  const b = pedidoBus();
  b.listeners.add(listener);
  return () => {
    b.listeners.delete(listener);
  };
}

export function eventMatchesPedido(
  event: PedidoEvent,
  codigoOrId?: string | null
): boolean {
  if (!codigoOrId) return true;
  return (
    event.pedido.codigo === codigoOrId || event.pedido.id === codigoOrId
  );
}

export function eventMatchesFecha(
  event: PedidoEvent,
  fecha?: string | null
): boolean {
  if (!fecha || fecha === "todos") return true;
  return event.pedido.fechaEntrega === fecha;
}

export function publishReservaEvent(
  type: ReservaEventType,
  reserva: ReservaPublica
): ReservaEvent {
  let resolved: ReservaEventType = type;
  if (type === "estado_cambiado") {
    if (reserva.estado === "listo" || reserva.estado === "lista")
      resolved = "listo";
    else if (reserva.estado === "entregado" || reserva.estado === "entregada")
      resolved = "entregado";
  }
  const event: ReservaEvent = {
    type: resolved,
    at: new Date().toISOString(),
    reserva,
  };
  const b = reservaBus();
  b.recent.push(event);
  if (b.recent.length > 50) b.recent.shift();
  for (const l of b.listeners) {
    try {
      l(event);
    } catch {
      /* listener roto */
    }
  }
  return event;
}

export function subscribeReservas(listener: ReservaListener): () => void {
  const b = reservaBus();
  b.listeners.add(listener);
  return () => {
    b.listeners.delete(listener);
  };
}

export function eventMatchesReserva(
  event: ReservaEvent,
  codigoOrId?: string | null
): boolean {
  if (!codigoOrId) return true;
  return (
    event.reserva.codigo === codigoOrId || event.reserva.id === codigoOrId
  );
}

export function eventMatchesReservaFecha(
  event: ReservaEvent,
  fecha?: string | null
): boolean {
  if (!fecha || fecha === "todos") return true;
  return event.reserva.fechaEntrega === fecha;
}
