/**
 * Estados unificados pedidos + reservaciones (contrato Project Tostal).
 * Mutaciones con email: `app/actions/estados` (Server Actions).
 */

export type EstadoFlujo =
  | "recibido"
  | "aceptado"
  | "preparando"
  | "listo"
  | "en_camino"
  | "entregado"
  | "cancelado";

export type ModoEntregaUi = "retiro" | "envio" | string | null | undefined;

/** Labels ES según contrato. */
export const ESTADO_LABEL: Record<EstadoFlujo, string> = {
  recibido: "Recibido",
  aceptado: "Aceptado",
  preparando: "Preparando",
  listo: "Listo / Esperando recolección",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Label corto para chips. */
export const ESTADO_LABEL_CORTO: Record<EstadoFlujo, string> = {
  recibido: "Recibido",
  aceptado: "Aceptado",
  preparando: "Preparando",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Códigos legacy → contrato. */
const LEGACY_TO_CONTRATO: Record<string, EstadoFlujo> = {
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
  // reservas legacy (femenino)
  pendiente_anticipo: "recibido",
  confirmada: "aceptado",
  lista: "listo",
  entregada: "entregado",
  cancelada: "cancelado",
  pendiente: "recibido",
};

export function normalizarEstado(raw: string | null | undefined): EstadoFlujo {
  if (!raw) return "recibido";
  const key = raw.trim().toLowerCase();
  return LEGACY_TO_CONTRATO[key] ?? "recibido";
}

export function labelEstado(raw: string | null | undefined): string {
  return ESTADO_LABEL[normalizarEstado(raw)];
}

export function labelEstadoCorto(raw: string | null | undefined): string {
  return ESTADO_LABEL_CORTO[normalizarEstado(raw)];
}

export type AccionEstado = {
  estado: EstadoFlujo;
  label: string;
  /** Primary CTA = siguiente paso obvio. */
  primaria?: boolean;
  variante?: "default" | "outline" | "destructive" | "secondary";
};

/**
 * Transiciones simples: avanzar / retroceder un paso + cancelar.
 * `en_camino` solo si entrega a domicilio.
 */
export function accionesDesdeEstado(
  raw: string | null | undefined,
  modoEntrega?: ModoEntregaUi
): AccionEstado[] {
  const estado = normalizarEstado(raw);
  const esEnvio = modoEntrega === "envio";
  const acciones: AccionEstado[] = [];

  const add = (
    e: EstadoFlujo,
    opts?: { primaria?: boolean; variante?: AccionEstado["variante"] }
  ) => {
    acciones.push({
      estado: e,
      label: ESTADO_LABEL_CORTO[e],
      primaria: opts?.primaria,
      variante:
        opts?.variante ??
        (opts?.primaria
          ? "default"
          : e === "cancelado"
            ? "destructive"
            : "outline"),
    });
  };

  switch (estado) {
    case "recibido":
      add("aceptado", { primaria: true });
      acciones.push({
        estado: "cancelado",
        label: "Anular",
        variante: "destructive",
      });
      break;
    case "aceptado":
      add("preparando", { primaria: true });
      add("recibido", { variante: "secondary" });
      acciones.push({
        estado: "cancelado",
        label: "Anular",
        variante: "destructive",
      });
      break;
    case "preparando":
      add("listo", { primaria: true });
      add("aceptado", { variante: "secondary" });
      acciones.push({
        estado: "cancelado",
        label: "Anular",
        variante: "destructive",
      });
      break;
    case "listo":
      if (esEnvio) {
        add("en_camino", { primaria: true });
        add("entregado");
      } else {
        add("entregado", { primaria: true });
      }
      add("preparando", { variante: "secondary" });
      acciones.push({
        estado: "cancelado",
        label: "Anular",
        variante: "destructive",
      });
      break;
    case "en_camino":
      add("entregado", { primaria: true });
      add("listo", { variante: "secondary" });
      acciones.push({
        estado: "cancelado",
        label: "Anular",
        variante: "destructive",
      });
      break;
    case "entregado":
    case "cancelado":
      // Terminales: permitir reabrir a recibido si hace falta.
      add("recibido", { variante: "secondary" });
      break;
  }

  return acciones;
}

export function esEstadoTerminal(raw: string | null | undefined): boolean {
  const e = normalizarEstado(raw);
  return e === "entregado" || e === "cancelado";
}

export function varianteBadgeEstado(
  raw: string | null | undefined
): "default" | "success-light" | "warning-light" | "destructive" | "secondary" {
  const e = normalizarEstado(raw);
  if (e === "entregado") return "success-light";
  if (e === "cancelado") return "destructive";
  if (e === "listo" || e === "en_camino") return "warning-light";
  if (e === "preparando" || e === "aceptado") return "default";
  return "secondary";
}
