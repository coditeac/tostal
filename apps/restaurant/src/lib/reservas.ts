import { apiFetch } from "@/lib/api";

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

function mapInsumo(raw: Record<string, unknown>): InsumoNecesario {
  const necesaria = Number(
    raw.cantidad_necesaria ?? raw.cantidadNecesaria ?? raw.cantidad ?? 0
  );
  const stock = Number(raw.stock_actual ?? raw.stockActual ?? 0);
  const faltante = Number(
    raw.faltante ?? Math.max(0, necesaria - stock)
  );
  return {
    insumoId: String(raw.insumo_id ?? raw.insumoId ?? raw.id ?? ""),
    nombre: String(raw.nombre ?? raw.insumoNombre ?? "Insumo"),
    unidad: String(raw.unidad ?? "u"),
    cantidadNecesaria: necesaria,
    stockActual: stock,
    faltante,
    requiereCompra: Boolean(
      raw.requiere_compra ?? raw.requiereCompra ?? faltante > 0
    ),
  };
}

function mapReserva(raw: Record<string, unknown>): ReservaCola {
  const insumosRaw = (raw.insumos_necesarios ??
    raw.insumosNecesarios ??
    []) as Array<Record<string, unknown>>;
  const productosRaw = (raw.productos ??
    raw.lineas ??
    []) as Array<Record<string, unknown>>;
  const insumos = insumosRaw.map(mapInsumo);
  const requiereCompra = Boolean(
    raw.requiere_compra ??
      raw.requiereCompra ??
      insumos.some((i) => i.requiereCompra)
  );

  return {
    id: String(raw.id ?? ""),
    codigo: raw.codigo ? String(raw.codigo) : undefined,
    fecha: String(raw.fecha ?? raw.fecha_entrega ?? ""),
    estado: String(raw.estado ?? "pendiente"),
    clienteNombre: String(
      raw.cliente_nombre ?? raw.clienteNombre ?? "Cliente"
    ),
    clienteTelefono: (raw.cliente_telefono ??
      raw.clienteTelefono ??
      null) as string | null,
    anticipo: Number(raw.anticipo ?? raw.anticipo_centavos ?? 0),
    total: raw.total != null ? Number(raw.total) : undefined,
    requiereCompra,
    productos: productosRaw.map((p) => ({
      productoId: String(p.producto_id ?? p.productoId ?? ""),
      nombre: String(p.nombre ?? p.productoNombre ?? "Producto"),
      cantidad: Number(p.cantidad ?? 1),
    })),
    insumosNecesarios: insumos,
    sugerenciasCompra: Array.isArray(raw.sugerencias)
      ? (raw.sugerencias as string[])
      : Array.isArray(raw.sugerenciasCompra)
        ? (raw.sugerenciasCompra as string[])
        : undefined,
  };
}

export async function listReservas(): Promise<{
  reservas: ReservaCola[];
  disponible: boolean;
  mensaje?: string;
}> {
  const res = await apiFetch("/api/reservas");
  if (res.status === 404) {
    return {
      reservas: [],
      disponible: false,
      mensaje:
        "La cola de reservas todavía no está en la API. Cuando se active, verás aquí insumos y compras sugeridas.",
    };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "No se pudieron cargar las reservas");
  }
  const list = (data.reservas || data.items || []) as Array<
    Record<string, unknown>
  >;
  return {
    reservas: list.map(mapReserva),
    disponible: true,
  };
}
