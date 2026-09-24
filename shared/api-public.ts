/**
 * Contratos públicos estables para App Cliente.
 * Base API Nest: http://127.0.0.1:4331 (prod: https://api.tostal.cafe)
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

/** POST /api/public/pedidos */
export type CrearPedidoRemotoBody = {
  fechaEntrega: string;
  modoEntrega: import("./types").ModoEntrega;
  zonaId?: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  /** Email guest o de la cuenta; requerido si no hay sesión. */
  clienteEmail?: string | null;
  email?: string | null;
  direccion?: string | null;
  metodoPago: import("./types").MetodoPago;
  notas?: string | null;
  lineas: import("./types").LineaPedidoInput[];
};

export type CrearPedidoRemotoResponse = {
  pedido: import("./types").PedidoPublico;
};

export type GetPedidoPublicoResponse = {
  pedido: import("./types").PedidoPublico;
};

export type PedidoSseEventType =
  | "snapshot"
  | "pedido_creado"
  | "estado_cambiado"
  | "pago_confirmado"
  | "listo"
  | "entregado"
  | "ping";

export type PedidoSsePayload = {
  type: PedidoSseEventType;
  at: string;
  pedido?: import("./types").PedidoPublico;
};

export type ApiErrorBody = { error: string };

export const PUBLIC_API = {
  dias: "/api/public/dias",
  menu: "/api/public/menu",
  pedidos: "/api/public/pedidos",
  pedidosEvents: "/api/public/pedidos/events",
} as const;

export const CLIENTE_AUTH_API = {
  policy: "/api/cliente/policy",
  register: "/api/cliente/register",
  login: "/api/cliente/login",
  logout: "/api/cliente/logout",
  me: "/api/cliente/me",
  pedidos: "/api/cliente/pedidos",
} as const;

export const RESTAURANT_DEV_ORIGIN = "http://127.0.0.1:4321";
export const API_DEV_ORIGIN = "http://127.0.0.1:4331";
export const CLIENTE_DEV_ORIGIN = "http://127.0.0.1:4322";
