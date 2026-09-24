"use client";

import { useEffect, useRef } from "react";
import type { PedidoPublico } from "../../../../shared/types";

type Handlers = {
  onSnapshot?: (pedidos: PedidoPublico[]) => void;
  onEvent?: (type: string, pedido: PedidoPublico) => void;
  onError?: (message: string) => void;
};

/**
 * SSE autenticado (misma origin → cookie de sesión).
 * GET /api/pedidos/events?fecha=
 */
export function useRestaurantPedidoEvents(
  fecha: string,
  handlers: Handlers,
  enabled = true
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    const url = `/api/pedidos/events?fecha=${encodeURIComponent(fecha)}`;
    const es = new EventSource(url);

    const onSnapshot = (raw: MessageEvent) => {
      try {
        const data = JSON.parse(String(raw.data)) as {
          pedidos?: PedidoPublico[];
        };
        if (data.pedidos) handlersRef.current.onSnapshot?.(data.pedidos);
      } catch {
        /* ignore */
      }
    };

    const onPedidoEvent = (raw: MessageEvent) => {
      try {
        const data = JSON.parse(String(raw.data)) as {
          type?: string;
          pedido?: PedidoPublico;
        };
        if (data.pedido) {
          handlersRef.current.onEvent?.(data.type || "estado_cambiado", data.pedido);
        }
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("snapshot", onSnapshot as EventListener);
    for (const t of [
      "pedido_creado",
      "estado_cambiado",
      "pago_confirmado",
      "listo",
      "entregado",
    ]) {
      es.addEventListener(t, onPedidoEvent as EventListener);
    }

    es.onerror = () => {
      handlersRef.current.onError?.("Reconectando cola…");
    };

    return () => es.close();
  }, [fecha, enabled]);
}
