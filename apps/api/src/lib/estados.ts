/**
 * Estados unificados pedidos + reservaciones (contrato Coditeac).
 * recibido → aceptado → preparando → listo → [en_camino si envío] → entregado | cancelado
 *
 * Acepta alias legacy en entrada; persiste y expone siempre el código canónico.
 */

export const ESTADOS_UNIFICADOS = [
  "recibido",
  "aceptado",
  "preparando",
  "listo",
  "en_camino",
  "entregado",
  "cancelado",
] as const;

export type EstadoUnificado = (typeof ESTADOS_UNIFICADOS)[number];

/** Alias históricos → canónico */
const ALIAS_A_CANONICO: Record<string, EstadoUnificado> = {
  recibido: "recibido",
  aceptado: "aceptado",
  preparando: "preparando",
  listo: "listo",
  en_camino: "en_camino",
  entregado: "entregado",
  cancelado: "cancelado",
  // pedidos legacy
  confirmado: "aceptado",
  en_produccion: "preparando",
  // reservas legacy
  pendiente_anticipo: "recibido",
  confirmada: "aceptado",
  lista: "listo",
  entregada: "entregado",
  cancelada: "cancelado",
};

export const ESTADO_LABEL_ES: Record<EstadoUnificado, string> = {
  recibido: "Recibido",
  aceptado: "Aceptado",
  preparando: "Preparando",
  listo: "Listo / Esperando recolección",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ORDEN: EstadoUnificado[] = [
  "recibido",
  "aceptado",
  "preparando",
  "listo",
  "en_camino",
  "entregado",
];

export function normalizarEstado(raw: string | null | undefined): EstadoUnificado | null {
  if (!raw) return null;
  return ALIAS_A_CANONICO[String(raw).trim()] ?? null;
}

export function esEstadoUnificado(v: string): v is EstadoUnificado {
  return (ESTADOS_UNIFICADOS as readonly string[]).includes(v);
}

export type ValidacionTransicion =
  | { ok: true; estado: EstadoUnificado }
  | { ok: false; error: string };

/**
 * Reglas simples: avanzar/retroceder un paso en el flujo,
 * cancelar desde no-terminal, y en_camino solo con envío.
 */
export function validarTransicionEstado(opts: {
  desde: string;
  hacia: string;
  modoEntrega?: "retiro" | "envio" | string | null;
}): ValidacionTransicion {
  const desde = normalizarEstado(opts.desde);
  const hacia = normalizarEstado(opts.hacia);
  if (!hacia) {
    return {
      ok: false,
      error: `Estado inválido. Usa: ${ESTADOS_UNIFICADOS.join(", ")}.`,
    };
  }
  if (!desde) {
    return { ok: true, estado: hacia };
  }
  if (desde === hacia) {
    return { ok: true, estado: hacia };
  }
  if (desde === "entregado" || desde === "cancelado") {
    return {
      ok: false,
      error: `No se puede cambiar un pedido/reserva en estado «${ESTADO_LABEL_ES[desde]}».`,
    };
  }
  if (hacia === "cancelado") {
    return { ok: true, estado: hacia };
  }
  if (hacia === "en_camino" && opts.modoEntrega !== "envio") {
    return {
      ok: false,
      error: "«En camino» solo aplica a entrega a domicilio.",
    };
  }

  const flujo = flujoParaModo(opts.modoEntrega);
  const iDesde = flujo.indexOf(desde);
  const iHacia = flujo.indexOf(hacia);
  if (iDesde < 0 || iHacia < 0) {
    return { ok: false, error: "Transición no permitida." };
  }
  const delta = Math.abs(iHacia - iDesde);
  // Un paso adelante/atrás, o saltar en_camino al cerrar (listo→entregado en retiro ya cubierto por flujo sin en_camino)
  if (delta === 1) return { ok: true, estado: hacia };
  // Permitir listo → entregado aunque exista en_camino en el flujo de envío (staff puede omitir)
  if (
    opts.modoEntrega === "envio" &&
    desde === "listo" &&
    hacia === "entregado"
  ) {
    return { ok: true, estado: hacia };
  }
  return {
    ok: false,
    error: `No se puede pasar de «${ESTADO_LABEL_ES[desde]}» a «${ESTADO_LABEL_ES[hacia]}». Avanza o retrocede un paso.`,
  };
}

function flujoParaModo(modo?: string | null): EstadoUnificado[] {
  if (modo === "envio") {
    return [
      "recibido",
      "aceptado",
      "preparando",
      "listo",
      "en_camino",
      "entregado",
    ];
  }
  return ["recibido", "aceptado", "preparando", "listo", "entregado"];
}

/** Estados "activos" (aún en cocina / pendientes). Incluye legacy para queries SQL. */
export function estadosActivosSqlIn(): string {
  return [
    "'recibido'",
    "'aceptado'",
    "'preparando'",
    "'listo'",
    "'en_camino'",
    "'confirmado'",
    "'en_produccion'",
    "'pendiente_anticipo'",
    "'confirmada'",
    "'lista'",
  ].join(",");
}

/** Estados terminales + legacy para exclusiones SQL. */
export function estadosCerradosSqlIn(): string {
  return ["'entregado'", "'cancelado'", "'entregada'", "'cancelada'"].join(",");
}

export function ordenColaEstado(estado: string): number {
  const n = normalizarEstado(estado);
  if (!n) return 99;
  const idx = ORDEN.indexOf(n);
  return idx < 0 ? 50 : idx;
}

export type EstadoHistorialEntry = {
  id: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  motivo: string | null;
  usuarioId: string | null;
  creadoEn: string;
};
