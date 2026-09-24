/**
 * Bus de eventos en memoria para SSE de pedidos.
 * Suficiente con 1 réplica Railway (tostal-api).
 */
import type { PedidoPublico } from "../../../../shared/types";

export type PedidoEventType =
  | "pedido_creado"
  | "estado_cambiado"
  | "pago_confirmado"
  | "listo"
  | "entregado";

export type PedidoEvent = {
  type: PedidoEventType;
  at: string;
  pedido: PedidoPublico;
};

type Listener = (event: PedidoEvent) => void;

const globalKey = "__tostal_pedido_bus__";

type Bus = {
  listeners: Set<Listener>;
  recent: PedidoEvent[];
};

function bus(): Bus {
  const g = globalThis as unknown as Record<string, Bus | undefined>;
  if (!g[globalKey]) {
    g[globalKey] = { listeners: new Set(), recent: [] };
  }
  return g[globalKey]!;
}

export function publishPedidoEvent(
  type: PedidoEventType,
  pedido: PedidoPublico
): PedidoEvent {
  // Derivar tipo más específico si aplica
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
  const b = bus();
  b.recent.push(event);
  if (b.recent.length > 50) b.recent.shift();
  for (const l of b.listeners) {
    try {
      l(event);
    } catch {
      /* listener roto: ignorar */
    }
  }
  return event;
}

export function subscribePedidos(listener: Listener): () => void {
  const b = bus();
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
