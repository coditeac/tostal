/**
 * Tipos de dominio API (Nest). Independientes de shared/fronts
 * para que el agente API pueda mergear sin tocar shared.
 */
export type AnticipoTipo = "porcentaje" | "monto";

export type ProductoApi = {
  id: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: boolean;
  fotoUrl: string | null;
  alergenos: string | null;
  orden: number;
  reservaHabilitada: boolean;
  anticipoTipo: AnticipoTipo;
  anticipoValor: number;
  /** Anticipación mínima (días civiles CDMX). Default 3. */
  reservaDiasMinimos: number;
  /** Cantidad mínima por línea de reserva. Default 1. */
  reservaCantidadMinima: number;
  /**
   * Piezas que rinde el lote de la receta (ej. 9 roles).
   * Las cantidades de insumos son del lote completo; default 1 = por pieza.
   */
  recetaRendimiento: number;
  duraciones?: Array<{
    id: string;
    etiqueta: string;
    minutos?: number | null;
  }> | null;
  categoriaNombre?: string | null;
};

/** Línea de receta con cantidad de lote + por_pieza calculado. */
export type LineaRecetaApi = {
  id: string;
  productoId: string;
  insumoId: string;
  /** Cantidad de insumo para el lote completo (`receta_rendimiento` piezas). */
  cantidad: number;
  /** Alias explícito de `cantidad` (lote). */
  cantidad_lote: number;
  /** cantidad_lote / receta_rendimiento */
  por_pieza: number;
  insumoNombre?: string;
  unidad?: "g" | "ml" | "u";
};

/**
 * Estados unificados (pedidos + reservaciones).
 * Alias legacy aún se aceptan en PATCH y se normalizan al escribir.
 */
export type EstadoReserva =
  | "recibido"
  | "aceptado"
  | "preparando"
  | "listo"
  | "en_camino"
  | "entregado"
  | "cancelado"
  // legacy (solo lectura/entrada)
  | "pendiente_anticipo"
  | "confirmada"
  | "en_produccion"
  | "lista"
  | "entregada"
  | "cancelada";

/** Re-export canónico para callers API. */
export type { EstadoUnificado, EstadoHistorialEntry } from "./estados";

export type EstadoAnticipo = "pendiente" | "pagado" | "reembolsado";

export type ReservaNecesidad = {
  id: string;
  reservaId: string;
  insumoId: string;
  insumoNombre: string;
  unidad: "g" | "ml" | "u";
  cantidadNecesaria: number;
  stockActual: number;
  faltante: number;
  requiereCompra: boolean;
};

export type ReservaPublica = {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  estadoAnticipo: EstadoAnticipo;
  metodoPago: string;
  modoEntrega: "retiro" | "envio";
  fechaEntrega: string;
  clienteNombre: string;
  clienteTelefono: string;
  subtotal: number;
  anticipoMonto: number;
  costoEnvio: number;
  total: number;
  notas: string | null;
  creadoEn: string;
  lineas: Array<{
    id: string;
    productoId: string;
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    notas: string | null;
  }>;
};

export type ProductoReservaPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoriaId: string | null;
  categoriaNombre: string | null;
  alergenos: string | null;
  fotoUrl: string | null;
  /** Alias contrato fronts / Rappi. */
  foto_url?: string | null;
  imagenUrl?: string | null;
  imagen_url?: string | null;
  anticipoTipo: AnticipoTipo;
  anticipoValor: number;
  anticipoUnitario: number;
  reservaDiasMinimos: number;
  reservaCantidadMinima: number;
  /** Alias snake_case para fronts. */
  reserva_dias_minimos: number;
  reserva_cantidad_minima: number;
  /** Primera fecha civil CDMX permitida (hoy + N). */
  fecha_minima: string;
};

export type MenuHoyResponse = {
  fecha: string;
  abierto: boolean;
  /** ISO datetime UTC — hora límite interpretada desde CDMX al guardar. */
  hora_limite: string;
  /** Alias camelCase para clientes TS. */
  horaLimite: string;
  /** Alias legado. */
  deadlinePedido: string;
  deadlineVigente: boolean;
  acepta_pedidos: boolean;
  aceptaPedidos: boolean;
  cupoMaximo: number | null;
  productos: Array<
    ProductoApi & {
      categoriaNombre: string | null;
      disponible: boolean;
    }
  >;
  categorias: unknown[];
  zonas: unknown[];
  config: unknown;
};
