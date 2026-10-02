/**
 * Estados de seguimiento (contrato pedidos/reservas).
 * Solo lectura en Cliente. Mapea códigos legacy de la API actual.
 */

export type EstadoSeguimiento =
  | "recibido"
  | "aceptado"
  | "preparando"
  | "listo"
  | "en_camino"
  | "entregado"
  | "cancelado";

export type ModoEntregaSeguimiento = "retiro" | "envio";

/** Labels ES del contrato. */
export const ESTADO_SEGUIMIENTO_LABEL: Record<EstadoSeguimiento, string> = {
  recibido: "Recibido",
  aceptado: "Aceptado",
  preparando: "Preparando",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Copy corta bajo el estado actual (inspirado delivery / Rappi). */
export const ESTADO_SEGUIMIENTO_HINT: Record<EstadoSeguimiento, string> = {
  recibido: "Ya tenemos tu solicitud. Te avisamos cuando la aceptemos.",
  aceptado: "Confirmado por cocina. Pronto empezamos a preparar.",
  preparando: "Estamos preparando tu pedido.",
  listo: "Listo para retiro o salida a domicilio.",
  en_camino: "Va en camino hacia ti.",
  entregado: "¡Listo! Gracias por elegir Tostal.",
  cancelado: "Este pedido fue cancelado.",
};

/**
 * Alias legacy → contrato.
 * Pedidos: confirmado/en_produccion
 * Reservas: pendiente_anticipo/confirmada/lista/entregada/cancelada
 */
const LEGACY_TO_CONTRATO: Record<string, EstadoSeguimiento> = {
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

export function normalizarEstado(raw: string | null | undefined): EstadoSeguimiento {
  if (!raw) return "recibido";
  const key = raw.trim().toLowerCase();
  return LEGACY_TO_CONTRATO[key] ?? "recibido";
}

export function labelEstado(raw: string | null | undefined): string {
  const n = normalizarEstado(raw);
  const known = LEGACY_TO_CONTRATO[String(raw || "").trim().toLowerCase()];
  if (known) return ESTADO_SEGUIMIENTO_LABEL[n];
  // Desconocido: humanizar snake_case
  return String(raw || "Recibido").replace(/_/g, " ");
}

export function hintEstado(raw: string | null | undefined): string {
  return ESTADO_SEGUIMIENTO_HINT[normalizarEstado(raw)];
}

/** Pasos del timeline (sin cancelado). `en_camino` solo si envío a domicilio. */
export function pasosTimeline(
  modoEntrega: ModoEntregaSeguimiento = "retiro"
): EstadoSeguimiento[] {
  const base: EstadoSeguimiento[] = [
    "recibido",
    "aceptado",
    "preparando",
    "listo",
  ];
  if (modoEntrega === "envio") base.push("en_camino");
  base.push("entregado");
  return base;
}

export type PasoTimelineStatus = "done" | "current" | "todo";

export function indicePaso(
  estadoRaw: string | null | undefined,
  pasos: EstadoSeguimiento[]
): number {
  const estado = normalizarEstado(estadoRaw);
  if (estado === "cancelado") return -1;
  const idx = pasos.indexOf(estado);
  if (idx >= 0) return idx;
  // Fallback por orden del contrato
  const orden: EstadoSeguimiento[] = [
    "recibido",
    "aceptado",
    "preparando",
    "listo",
    "en_camino",
    "entregado",
  ];
  const oi = orden.indexOf(estado);
  if (oi < 0) return 0;
  // Mapear al paso más cercano ya pasado en `pasos`
  let best = 0;
  for (let i = 0; i < pasos.length; i++) {
    if (orden.indexOf(pasos[i]) <= oi) best = i;
  }
  return best;
}

export function statusPaso(
  i: number,
  currentIdx: number,
  cancelado: boolean
): PasoTimelineStatus {
  if (cancelado) return "todo";
  if (i < currentIdx) return "done";
  if (i === currentIdx) return "current";
  return "todo";
}

export type HistorialItem = {
  estado: string;
  at?: string | null;
  nota?: string | null;
};

/** Lee `estado_historial` si la API lo expone (snake o camel). */
export function leerHistorial(entity: Record<string, unknown> | null | undefined): HistorialItem[] {
  if (!entity) return [];
  const raw =
    entity.estado_historial ??
    entity.estadoHistorial ??
    entity.historial_estado ??
    entity.historialEstado;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const estado = String(o.estado ?? o.status ?? "");
      if (!estado) return null;
      return {
        estado,
        at: (o.at as string) || (o.en as string) || (o.creado_en as string) || null,
        nota: (o.nota as string) || (o.motivo as string) || null,
      };
    })
    .filter(Boolean) as HistorialItem[];
}
