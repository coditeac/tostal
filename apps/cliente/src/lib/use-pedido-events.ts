"use client";

import { useEffect, useRef } from "react";
import { getApiBase } from "@/lib/api";
import { PUBLIC_API } from "@tostal/shared/api-public";
import type { PedidoPublico } from "@tostal/shared/types";

type Handlers = {
  onPedido: (pedido: PedidoPublico) => void;
  onError?: (message: string) => void;
};

/**
 * Suscribe al SSE público de un pedido. Reconecta solo (EventSource nativo).
 * Fallback: el caller puede seguir con polling si onError / sin soporte.
 */
export function usePedidoEvents(codigo: string | null | undefined, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!codigo || typeof EventSource === "undefined") return;

    const url = `${getApiBase()}${PUBLIC_API.pedidosEvents}?codigo=${encodeURIComponent(codigo)}`;
    const es = new EventSource(url);
    let closed = false;

    const apply = (raw: MessageEvent) => {
      try {
        const data = JSON.parse(String(raw.data)) as {
          type?: string;
          pedido?: PedidoPublico;
        };
        if (data.pedido) handlersRef.current.onPedido(data.pedido);
      } catch {
        /* ignore malformed */
      }
    };

    const types = [
      "snapshot",
      "pedido_creado",
      "estado_cambiado",
      "pago_confirmado",
      "listo",
      "entregado",
    ];
    for (const t of types) {
      es.addEventListener(t, apply as EventListener);
    }

    es.onerror = () => {
      // EventSource reintenta solo; avisar una vez
      handlersRef.current.onError?.("Reconectando seguimiento…");
    };

    return () => {
      closed = true;
      void closed;
      es.close();
    };
  }, [codigo]);
}
