"use client";

import { useEffect, useRef } from "react";
import { subscribePedidosFecha } from "@/lib/data/pedidos";

type Handlers = {
  onSnapshot?: (pedidos: unknown[]) => void;
  onEvent?: (type: string, pedido: unknown) => void;
  onError?: (message: string) => void;
};

/**
 * Realtime Supabase en `pedidos` (reemplaza SSE Nest).
 */
export function useRestaurantPedidoEvents(
  fecha: string,
  handlers: Handlers,
  enabled = true
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    try {
      const unsub = subscribePedidosFecha(fecha, () => {
        handlersRef.current.onEvent?.("estado_cambiado", {});
      });
      return unsub;
    } catch (e) {
      handlersRef.current.onError?.(
        e instanceof Error ? e.message : "Realtime no disponible"
      );
    }
  }, [fecha, enabled]);
}
