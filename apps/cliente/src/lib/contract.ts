/**
 * Tipos Cliente alineados al contrato menú diario + reservas.
 * Solo apps/cliente — no edita shared (ownership API).
 */

import type {
  Categoria,
  ConfiguracionPublica,
  MetodoPago,
  Producto,
  ZonaEnvio,
} from "@tostal/shared/types";

export type AnticipoTipo = "porcentaje" | "monto" | "percent" | "fixed";

export type MenuProducto = Producto & {
  categoriaNombre: string | null;
  disponible?: boolean;
};

/** Respuesta normalizada de GET /api/public/menu (hoy). */
export type MenuHoy = {
  fecha: string;
  horaLimite: string | null;
  aceptaPedidos: boolean;
  /** Día operativo abierto (staff). Puede ser true aunque ya no acepte por hora límite. */
  abierto: boolean;
  /** true si aún no pasó la hora límite CDMX. */
  deadlineVigente: boolean;
  cupoMaximo: number | null;
  productos: MenuProducto[];
  categorias: Categoria[];
  zonas: ZonaEnvio[];
  config: ConfiguracionPublica;
};

/** Defaults contrato cuando el producto no define reglas. */
export const RESERVA_DIAS_MINIMOS_DEFAULT = 3;
export const RESERVA_CANTIDAD_MINIMA_DEFAULT = 1;

/** Producto elegible para reserva (contrato). */
export type ReservaProducto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  fotoUrl: string | null;
  alergenos: string | null;
  categoriaNombre: string | null;
  reservaHabilitada: boolean;
  anticipoTipo: AnticipoTipo | null;
  anticipoValor: number | null;
  /** Anticipación mínima: fecha ≥ hoy CDMX + N días. */
  reservaDiasMinimos: number;
  /** Cantidad mínima por línea de reserva. */
  reservaCantidadMinima: number;
};

export type ReservasProductosResponse = {
  productos: ReservaProducto[];
  config?: ConfiguracionPublica;
};

export type CrearReservaBody = {
  /** Alias contrato; API acepta también fechaEntrega. */
  fecha: string;
  fechaEntrega?: string;
  modoEntrega?: "retiro" | "envio";
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail?: string | null;
  metodoPago: Extract<MetodoPago, "transferencia" | "stripe">;
  notas?: string | null;
  lineas: Array<{
    productoId: string;
    cantidad: number;
  }>;
};

export type CrearReservaResponse = {
  reserva: {
    id: string;
    codigo: string;
    fechaEntrega: string;
    total: number;
    anticipoMonto: number;
    estado?: string;
    estadoAnticipo?: string;
    checkoutUrl?: string | null;
  };
};

/** Paths del contrato (además de PUBLIC_API legacy). */
export const CONTRATO_API = {
  menu: "/api/public/menu",
  reservasProductos: "/api/public/reservas/productos",
  reservas: "/api/public/reservas",
  pedidos: "/api/public/pedidos",
} as const;

type RawMenu = Record<string, unknown> & {
  fecha?: string;
  hora_limite?: string | null;
  horaLimite?: string | null;
  deadlinePedido?: string | null;
  acepta_pedidos?: boolean;
  aceptaPedidos?: boolean;
  abierto?: boolean;
  deadlineVigente?: boolean;
  cupoMaximo?: number | null;
  productos?: MenuProducto[];
  categorias?: Categoria[];
  zonas?: ZonaEnvio[];
  config?: ConfiguracionPublica;
};

export function normalizeMenuHoy(raw: RawMenu, fallbackFecha: string): MenuHoy {
  const horaLimite =
    (typeof raw.hora_limite === "string" && raw.hora_limite) ||
    (typeof raw.horaLimite === "string" && raw.horaLimite) ||
    (typeof raw.deadlinePedido === "string" && raw.deadlinePedido) ||
    null;

  const aceptaExplicit =
    typeof raw.acepta_pedidos === "boolean"
      ? raw.acepta_pedidos
      : typeof raw.aceptaPedidos === "boolean"
        ? raw.aceptaPedidos
        : null;

  const deadlineVigente =
    typeof raw.deadlineVigente === "boolean"
      ? raw.deadlineVigente
      : horaLimite
        ? new Date() < new Date(horaLimite)
        : true;

  // API pública manda `abierto` = acepta (combinado). Preferimos acepta_* /
  // deadline para el flag de compra; `abierto` aquí = "¿se puede pedir ahora?".
  const aceptaPedidos =
    aceptaExplicit !== null ? aceptaExplicit : raw.abierto !== false && deadlineVigente;

  return {
    fecha: typeof raw.fecha === "string" ? raw.fecha : fallbackFecha,
    horaLimite,
    aceptaPedidos,
    abierto: aceptaPedidos || (raw.abierto !== false && deadlineVigente),
    deadlineVigente,
    cupoMaximo: raw.cupoMaximo ?? null,
    productos: Array.isArray(raw.productos) ? raw.productos : [],
    categorias: Array.isArray(raw.categorias) ? raw.categorias : [],
    zonas: Array.isArray(raw.zonas) ? raw.zonas : [],
    config: raw.config || {
      marca: "Tostal",
      eslogan: "Sabores que unen culturas",
      moneda: "MXN",
      canalRemotoActivo: true,
      canalMostradorActivo: false,
    },
  };
}

type RawReservaProducto = Record<string, unknown>;

function intOrDefault(raw: unknown, fallback: number, min: number): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.trunc(n));
}

export function normalizeReservaProducto(raw: RawReservaProducto): ReservaProducto {
  const anticipoTipoRaw =
    (raw.anticipo_tipo as string | null | undefined) ??
    (raw.anticipoTipo as string | null | undefined) ??
    null;
  const anticipoValorRaw =
    (raw.anticipo_valor as number | null | undefined) ??
    (raw.anticipoValor as number | null | undefined) ??
    null;

  return {
    id: String(raw.id),
    nombre: String(raw.nombre || "Producto"),
    descripcion: (raw.descripcion as string | null) ?? null,
    precio: Number(raw.precio || 0),
    fotoUrl: (raw.foto_url as string | null) ?? (raw.fotoUrl as string | null) ?? null,
    alergenos: (raw.alergenos as string | null) ?? null,
    categoriaNombre:
      (raw.categoria_nombre as string | null) ??
      (raw.categoriaNombre as string | null) ??
      null,
    reservaHabilitada:
      raw.reserva_habilitada === true ||
      raw.reservaHabilitada === true ||
      true,
    anticipoTipo: (anticipoTipoRaw as AnticipoTipo | null) || "porcentaje",
    anticipoValor:
      typeof anticipoValorRaw === "number" ? anticipoValorRaw : 30,
    reservaDiasMinimos: intOrDefault(
      raw.reserva_dias_minimos ?? raw.reservaDiasMinimos,
      RESERVA_DIAS_MINIMOS_DEFAULT,
      0
    ),
    reservaCantidadMinima: intOrDefault(
      raw.reserva_cantidad_minima ?? raw.reservaCantidadMinima,
      RESERVA_CANTIDAD_MINIMA_DEFAULT,
      1
    ),
  };
}

/** Máximo de días mínimos entre productos seleccionados (o catálogo). */
export function maxDiasMinimos(
  productos: ReservaProducto[],
  fallback = RESERVA_DIAS_MINIMOS_DEFAULT
): number {
  if (productos.length === 0) return fallback;
  return Math.max(...productos.map((p) => p.reservaDiasMinimos));
}

export function labelDiasMinimos(dias: number): string {
  if (dias <= 0) return "Puedes reservar desde hoy (CDMX)";
  if (dias === 1) return "Con al menos 1 día de anticipación (CDMX)";
  return `Con al menos ${dias} días de anticipación (CDMX)`;
}

export function labelCantidadMinima(min: number): string {
  if (min <= 1) return "Cantidad mínima: 1";
  return `Cantidad mínima: ${min}`;
}

/** Calcula anticipo en centavos a partir del total de líneas. */
export function calcularAnticipo(
  totalCentavos: number,
  tipo: AnticipoTipo | null,
  valor: number | null
): number {
  if (valor == null || valor < 0) return 0;
  const t = tipo || "porcentaje";
  if (t === "monto" || t === "fixed") return Math.min(Math.round(valor), totalCentavos);
  // porcentaje: valor 30 = 30%
  return Math.round((totalCentavos * valor) / 100);
}

export function labelAnticipo(
  tipo: AnticipoTipo | null,
  valor: number | null,
  monedaFmt: (cents: number) => string
): string {
  if (valor == null) return "Anticipo a confirmar";
  const t = tipo || "porcentaje";
  if (t === "monto" || t === "fixed") return `Anticipo ${monedaFmt(valor)}`;
  return `Anticipo ${valor}%`;
}
