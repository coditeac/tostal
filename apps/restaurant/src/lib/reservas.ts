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

function mapInsumo(raw: Record<string, unknown>): InsumoNecesario {
  const necesaria = Number(
    raw.cantidad_necesaria ?? raw.cantidadNecesaria ?? raw.cantidad ?? 0
  );
  const stock = Number(raw.stock_actual ?? raw.stockActual ?? 0);
  const faltante = Number(raw.faltante ?? Math.max(0, necesaria - stock));
  return {
    insumoId: String(raw.insumo_id ?? raw.insumoId ?? ""),
    nombre: String(
      raw.insumo_nombre ?? raw.insumoNombre ?? raw.nombre ?? "Insumo"
    ),
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
    raw.necesidades ??
    []) as Array<Record<string, unknown>>;

  const sugerenciasRaw = (raw.sugerencias_compra ??
    raw.sugerenciasCompra ??
    raw.sugerencias ??
    []) as unknown[];

  const productosRaw = (raw.lineas ??
    raw.productos ??
    []) as Array<Record<string, unknown>>;

  const insumos = insumosRaw.map(mapInsumo);
  const requiereCompra = Boolean(
    raw.requiere_compra ??
      raw.requiereCompra ??
      insumos.some((i) => i.requiereCompra)
  );

  const sugerenciasCompra = sugerenciasRaw
    .map((s) => {
      if (typeof s === "string") return s;
      const o = s as Record<string, unknown>;
      const nombre = String(
        o.insumo_nombre ?? o.insumoNombre ?? o.nombre ?? ""
      );
      const faltante = o.faltante ?? o.cantidad_faltante;
      const unidad = o.unidad ? String(o.unidad) : "";
      if (!nombre) return "";
      return faltante != null
        ? `${nombre}: faltan ${faltante}${unidad}`
        : nombre;
    })
    .filter(Boolean);

  return {
    id: String(raw.id ?? ""),
    codigo: raw.codigo ? String(raw.codigo) : undefined,
    fecha: String(
      raw.fechaEntrega ?? raw.fecha_entrega ?? raw.fecha ?? ""
    ),
    estado: String(raw.estado ?? "pendiente"),
    estadoAnticipo: raw.estadoAnticipo
      ? String(raw.estadoAnticipo)
      : raw.estado_anticipo
        ? String(raw.estado_anticipo)
        : undefined,
    clienteNombre: String(
      raw.clienteNombre ?? raw.cliente_nombre ?? "Cliente"
    ),
    clienteTelefono: (raw.clienteTelefono ??
      raw.cliente_telefono ??
      null) as string | null,
    anticipo: Number(
      raw.anticipoMonto ?? raw.anticipo_monto ?? raw.anticipo ?? 0
    ),
    total: raw.total != null ? Number(raw.total) : undefined,
    requiereCompra,
    productos: productosRaw.map((p) => ({
      productoId: String(p.productoId ?? p.producto_id ?? ""),
      nombre: String(p.productoNombre ?? p.producto_nombre ?? p.nombre ?? "Producto"),
      cantidad: Number(p.cantidad ?? 1),
    })),
    insumosNecesarios: insumos,
    sugerenciasCompra:
      sugerenciasCompra.length > 0 ? sugerenciasCompra : undefined,
  };
}

export async function listReservas(): Promise<{
  reservas: ReservaCola[];
  disponible: boolean;
  mensaje?: string;
}> {
  // Contrato 6 módulos: /api/reservaciones (alias /api/reservas).
  let res = await apiFetch("/api/reservaciones");
  if (res.status === 404) {
    res = await apiFetch("/api/reservas");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "No se pudieron cargar las reservaciones");
  }
  const list = (data.reservas || []) as Array<Record<string, unknown>>;
  return {
    reservas: list.map(mapReserva),
    disponible: true,
  };
}
