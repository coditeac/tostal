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
  abierto: boolean;
  cupoMaximo: number | null;
  productos: MenuProducto[];
  categorias: Categoria[];
  zonas: ZonaEnvio[];
  config: ConfiguracionPublica;
};

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

  const abierto = raw.abierto !== false;
  const deadlineVigente =
    typeof raw.deadlineVigente === "boolean"
      ? raw.deadlineVigente
      : horaLimite
        ? new Date() < new Date(horaLimite)
        : true;

  const aceptaPedidos =
    aceptaExplicit !== null ? aceptaExplicit : abierto && deadlineVigente;

  return {
    fecha: typeof raw.fecha === "string" ? raw.fecha : fallbackFecha,
    horaLimite,
    aceptaPedidos,
    abierto,
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
  };
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
