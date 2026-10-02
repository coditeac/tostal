export type InsumoNecesario = {
  insumoId: string;
  nombre: string;
  unidad: string;
  cantidadNecesaria: number;
  stockActual: number;
  faltante: number;
  requiereCompra: boolean;
};

export type ReservaCola = {
  id: string;
  codigo?: string;
  fecha: string;
  estado: string;
  estadoAnticipo?: string;
  clienteNombre: string;
  clienteTelefono?: string | null;
  anticipo: number;
  total?: number;
  requiereCompra: boolean;
  productos: Array<{
    productoId: string;
    nombre: string;
    cantidad: number;
  }>;
  insumosNecesarios: InsumoNecesario[];
  sugerenciasCompra?: string[];
};
