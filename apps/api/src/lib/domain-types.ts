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
  duraciones?: Array<{
    id: string;
    etiqueta: string;
    minutos?: number | null;
  }> | null;
  categoriaNombre?: string | null;
};

export type EstadoReserva =
  | "pendiente_anticipo"
  | "confirmada"
  | "en_produccion"
  | "lista"
  | "entregada"
  | "cancelada";

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
  anticipoTipo: AnticipoTipo;
  anticipoValor: number;
  anticipoUnitario: number;
};

export type MenuHoyResponse = {
  fecha: string;
  abierto: boolean;
  /** ISO datetime — hora límite de pedidos para ese día. */
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
