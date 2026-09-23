/**
 * Contratos públicos estables para App Cliente.
 * No romper shapes sin coordinar con el agent de Cliente.
 *
 * Base: http://127.0.0.1:4321
 * Precios en centavos (integer).
 */

export type {
  CanalVenta,
  Categoria,
  ConfiguracionPublica,
  DiaOperativo,
  EstadoPago,
  EstadoPedido,
  LineaPedidoInput,
  MenuDiaResponse,
  MetodoPago,
  ModoEntrega,
  PedidoPublico,
  Producto,
  ZonaEnvio,
} from "./types";

/** GET /api/public/dias */
export type PublicDiasResponse = {
  dias: Array<{
    id: string;
    fecha: string;
    abierto: boolean;
    deadlinePedido: string;
    cupoMaximo: number | null;
    notas: string | null;
    deadlineVigente: boolean;
  }>;
  config: import("./types").ConfiguracionPublica;
};

/** GET /api/public/menu?fecha=YYYY-MM-DD → MenuDiaResponse */

/** POST /api/public/pedidos */
export type CrearPedidoRemotoBody = {
  fechaEntrega: string;
  modoEntrega: import("./types").ModoEntrega;
  zonaId?: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  direccion?: string | null;
  metodoPago: import("./types").MetodoPago;
  notas?: string | null;
  lineas: import("./types").LineaPedidoInput[];
};

export type CrearPedidoRemotoResponse = {
  pedido: import("./types").PedidoPublico;
};

/** GET /api/public/pedidos?codigo= */
export type GetPedidoPublicoResponse = {
  pedido: import("./types").PedidoPublico;
};

export type ApiErrorBody = { error: string };

export const PUBLIC_API = {
  dias: "/api/public/dias",
  menu: "/api/public/menu",
  pedidos: "/api/public/pedidos",
} as const;

export const RESTAURANT_DEV_ORIGIN = "http://127.0.0.1:4321";
export const CLIENTE_DEV_ORIGIN = "http://127.0.0.1:4322";
