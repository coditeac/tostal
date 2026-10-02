"use client";

import { useEffect, useRef } from "react";
import { getApiBase } from "@/lib/api";
import { CONTRATO_API } from "@/lib/contract";
import type { ReservaPublicaSeguimiento } from "@/lib/contract";

type Handlers = {
  onReserva: (reserva: ReservaPublicaSeguimiento) => void;
  onError?: (message: string) => void;
};

/**
 * SSE público de reserva: GET /api/public/reservas/events?codigo=
 * Fallback: polling en la página si onError / sin EventSource.
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
    if (!codigo || typeof EventSource === "undefined") return;

    const url = `${getApiBase()}${CONTRATO_API.reservasEvents}?codigo=${encodeURIComponent(codigo)}`;
    const es = new EventSource(url);

    const apply = (raw: MessageEvent) => {
      try {
        const data = JSON.parse(String(raw.data)) as {
          type?: string;
          reserva?: ReservaPublicaSeguimiento;
        };
        if (data.reserva) handlersRef.current.onReserva(data.reserva);
      } catch {
        /* ignore malformed */
      }
    };

    const types = [
      "snapshot",
      "reserva_creada",
      "estado_cambiado",
      "anticipo_confirmado",
      "listo",
      "entregado",
      "en_camino",
      "aceptado",
      "preparando",
      "cancelado",
      "ping",
    ];
    for (const t of types) {
      es.addEventListener(t, apply as EventListener);
    }
    es.onmessage = apply;

    es.onerror = () => {
      handlersRef.current.onError?.("Reconectando seguimiento…");
    };

    return () => {
      es.close();
    };
  }, [codigo]);
}
