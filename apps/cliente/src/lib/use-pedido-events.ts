"use client";

import { useEffect, useRef } from "react";
import { fetchPedido } from "@/lib/api";
import { createClienteBrowserClient } from "@/lib/supabase/client";
import type { PedidoPublico } from "@tostal/shared/types";

type Handlers = {
  onPedido: (pedido: PedidoPublico) => void;
  onError?: (message: string) => void;
};

/**
 * Seguimiento en vivo vía Supabase Realtime (+ snapshot RPC).
 * Guest: Realtime puede no ver fila por RLS → polling RPC sigue en la página.
 */
export function usePedidoEvents(
  codigo: string | null | undefined,
  handlers: Handlers
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!codigo) return;
    const clean = codigo.trim().toUpperCase();
    let cancelled = false;
    const sb = createClienteBrowserClient();

    void fetchPedido(clean)
      .then((data) => {
        if (!cancelled && data.pedido) {
          handlersRef.current.onPedido(data.pedido);
        }
      })
      .catch(() => {
        handlersRef.current.onError?.("No se pudo cargar el pedido");
      });

    const channel = sb
      .channel(`pedido-${clean}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos",
          filter: `codigo=eq.${clean}`,
        },
        () => {
          void fetchPedido(clean)
            .then((data) => {
              if (data.pedido) handlersRef.current.onPedido(data.pedido);
            })
            .catch(() => {
              handlersRef.current.onError?.("Reconectando seguimiento…");
            });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          handlersRef.current.onError?.("Reconectando seguimiento…");
        }
      });

    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [codigo]);
}
