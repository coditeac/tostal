"use client";

import { useEffect, useRef } from "react";
import { fetchReserva } from "@/lib/api";
import { createClienteBrowserClient } from "@/lib/supabase/client";
import type { ReservaPublicaSeguimiento } from "@/lib/contract";

type Handlers = {
  onReserva: (reserva: ReservaPublicaSeguimiento) => void;
  onError?: (message: string) => void;
};

/**
 * Seguimiento reserva vía Supabase Realtime + RPC snapshot.
 * Misma UX que el SSE Nest (#36); fuente de datos = Supabase.
 */
export function useReservaEvents(
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

    void fetchReserva(clean)
      .then((data) => {
        if (!cancelled && data.reserva) {
          handlersRef.current.onReserva(data.reserva);
        }
      })
      .catch(() => {
        handlersRef.current.onError?.("No se pudo cargar la reserva");
      });

    const channel = sb
      .channel(`reserva-${clean}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservas",
          filter: `codigo=eq.${clean}`,
        },
        () => {
          void fetchReserva(clean)
            .then((data) => {
              if (data.reserva) handlersRef.current.onReserva(data.reserva);
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
