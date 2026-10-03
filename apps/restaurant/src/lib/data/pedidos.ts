"use client";

import { createClient } from "@/lib/supabase/client";
import type { EstadoFlujo } from "@/lib/estados";
import { ensureIngresoPedidoEntregado } from "@/lib/data/ingreso-entrega";

export type PedidoUi = {
  id: string;
  codigo: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteEmail: string | null;
  fechaEntrega: string;
  canal: string;
  modoEntrega: string;
  metodoPago: string | null;
  estado: string;
  estadoPago: string;
  total: number;
  notas: string | null;
  lineas: Array<{
    productoId: string | null;
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
  }>;
};

function mapModoEntrega(p: Record<string, unknown>): string {
  const raw = String(
    p.modo_entrega ?? p.tipo_entrega ?? p.modoEntrega ?? ""
  )
    .trim()
    .toLowerCase();
  return raw === "envio" ? "envio" : "retiro";
}

function mapEstadoPago(p: Record<string, unknown>): string {
  const raw = String(p.estado_pago ?? p.estadoPago ?? "pendiente")
    .trim()
    .toLowerCase();
  if (
    raw === "pagado" ||
    raw === "contra_entrega" ||
    raw === "pendiente_verificacion" ||
    raw === "fallido" ||
    raw === "rechazado" ||
    raw === "reembolsado"
  ) {
    return raw;
  }
  return "pendiente";
}

function mapPedido(
  p: Record<string, unknown>,
  items: Array<Record<string, unknown>>
): PedidoUi {
  return {
    id: String(p.id),
    codigo: String(p.codigo || ""),
    clienteNombre: String(p.cliente_nombre || "Cliente"),
    clienteTelefono: (p.cliente_telefono as string) || null,
    clienteEmail: (p.cliente_email as string) || null,
    fechaEntrega: String(p.fecha_entrega || ""),
    canal: String(p.canal || "remoto"),
    modoEntrega: mapModoEntrega(p),
    metodoPago: (p.metodo_pago as string) || null,
    estado: String(p.estado || "recibido"),
    estadoPago: mapEstadoPago(p),
    total: Number(p.total) || 0,
    notas: (p.notas as string) || null,
    lineas: items.map((it) => ({
      productoId: (it.producto_id as string) || null,
      productoNombre: String(it.nombre || "Producto"),
      cantidad: Number(it.cantidad) || 0,
      precioUnitario: Number(it.precio_unitario) || 0,
    })),
  };
}

export async function listPedidosByFecha(
  fecha: string,
  opts?: { incluirAnulados?: boolean }
): Promise<PedidoUi[]> {
  const supabase = createClient();
  let q = supabase
    .from("pedidos")
    .select("*")
    .eq("fecha_entrega", fecha)
    .order("created_at", { ascending: false });
  if (!opts?.incluirAnulados) {
    q = q.neq("estado", "cancelado");
  }
  const { data: pedidos, error } = await q;
  if (error) throw new Error(error.message);
  if (!pedidos?.length) return [];

  const ids = pedidos.map((p) => p.id);
  const { data: items, error: e2 } = await supabase
    .from("pedido_items")
    .select("*")
    .in("pedido_id", ids);
  if (e2) throw new Error(e2.message);

  const byPedido = new Map<string, Array<Record<string, unknown>>>();
  for (const it of items || []) {
    const list = byPedido.get(it.pedido_id) || [];
    list.push(it as unknown as Record<string, unknown>);
    byPedido.set(it.pedido_id, list);
  }

  return pedidos.map((p) =>
    mapPedido(p as unknown as Record<string, unknown>, byPedido.get(p.id) || [])
  );
}

export async function updatePedidoEstado(
  id: string,
  estado: EstadoFlujo,
  motivo?: string
): Promise<PedidoUi> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: prev, error: e0 } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", id)
    .single();
  if (e0 || !prev) throw new Error(e0?.message || "Pedido no encontrado");

  const { data, error } = await supabase
    .from("pedidos")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("estado_historial").insert({
    entidad: "pedido",
    entidad_id: id,
    estado_anterior: prev.estado,
    estado_nuevo: estado,
    usuario_id: user?.id ?? null,
    motivo: motivo ?? null,
  });

  if (estado === "entregado") {
    try {
      await ensureIngresoPedidoEntregado(
        supabase,
        {
          id: data.id,
          codigo: data.codigo,
          total: data.total,
          subtotal: data.subtotal,
          costo_envio: data.costo_envio,
          estado_pago: data.estado_pago,
          metodo_pago: data.metodo_pago,
        },
        user?.id ?? null
      );
    } catch (e) {
      console.error("[finanzas:ingreso_pedido_client]", e);
    }
  }

  const { data: items } = await supabase
    .from("pedido_items")
    .select("*")
    .eq("pedido_id", id);

  return mapPedido(
    data as unknown as Record<string, unknown>,
    (items || []) as unknown as Array<Record<string, unknown>>
  );
}

/** Realtime cola de pedidos para una fecha. */
export function subscribePedidosFecha(
  fecha: string,
  onChange: () => void
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`pedidos-${fecha}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "pedidos",
        filter: `fecha_entrega=eq.${fecha}`,
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
