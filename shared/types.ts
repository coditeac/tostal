/** Tipos compartidos Tostal — App Cliente + App Restaurant */

export type RolRestaurant = "admin" | "cocina" | "caja";
export type CanalVenta = "remoto" | "mostrador";
export type ModoEntrega = "retiro" | "envio";
export type EstadoPedido =
  | "recibido"
  | "confirmado"
  | "en_produccion"
  | "listo"
  | "entregado"
  | "cancelado";
export type EstadoPago =
  | "pendiente"
  | "pagado"
  | "contra_entrega"
  | "fallido"
  | "reembolsado";
export type MetodoPago =
  | "transferencia"
  | "contra_entrega"
  | "stripe"
  | "efectivo_mostrador";
export type UnidadInsumo = "g" | "ml" | "u";
export type TipoMovimiento =
  | "entrada"
  | "salida"
  | "ajuste"
  | "merma"
  | "produccion";
export type EstadoAvisoWhatsApp = "pendiente" | "enviado" | "omitido";

export interface ConfiguracionPublica {
  marca: string;
  eslogan: string;
  moneda: string;
  canalRemotoActivo: boolean;
  canalMostradorActivo: boolean;
  telefonoWhatsApp?: string | null;
  direccionRetiro?: string | null;
  /** Si true, el checkout exige sesión de cuenta cliente. Default false (guest+email OK). */
  checkoutRequiereCuenta?: boolean;
  /** Si true, la UI recomienda crear/iniciar sesión al pedir. Default true. */
  checkoutRecomiendaCuenta?: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
}

export interface Producto {
  id: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: boolean;
  fotoUrl: string | null;
  alergenos: string | null;
  orden: number;
}

export interface Insumo {
  id: string;
  nombre: string;
  unidad: UnidadInsumo;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  ubicacion: string | null;
  proveedorPreferido: string | null;
}

export interface LineaReceta {
  id: string;
  productoId: string;
  insumoId: string;
  cantidad: number;
  insumoNombre?: string;
  unidad?: UnidadInsumo;
}

export interface DiaOperativo {
  id: string;
  fecha: string; // YYYY-MM-DD
  abierto: boolean;
  deadlinePedido: string; // ISO datetime
  cupoMaximo: number | null;
  notas: string | null;
}

export interface DisponibilidadProductoDia {
  id: string;
  fecha: string;
  productoId: string;
  disponible: boolean;
}

export interface ZonaEnvio {
  id: string;
  nombre: string;
  cobertura: string | null;
  costoEnvio: number;
  activa: boolean;
}

export interface LineaPedidoInput {
  productoId: string;
  cantidad: number;
  notas?: string | null;
}

export interface PedidoPublico {
  id: string;
  codigo: string;
  canal: CanalVenta;
  estado: EstadoPedido;
  estadoPago: EstadoPago;
  metodoPago: MetodoPago;
  modoEntrega: ModoEntrega;
  fechaEntrega: string;
  clienteNombre: string;
  clienteTelefono: string;
  subtotal: number;
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
}

export interface MenuDiaResponse {
  fecha: string;
  abierto: boolean;
  deadlinePedido: string;
  deadlineVigente: boolean;
  cupoMaximo: number | null;
  productos: Array<
    Producto & {
      categoriaNombre: string | null;
      disponible: boolean;
    }
  >;
  categorias: Categoria[];
  zonas: ZonaEnvio[];
  config: ConfiguracionPublica;
}

export const MARCA = "Tostal";
export const ESLOGAN = "Sabores que unen culturas";
