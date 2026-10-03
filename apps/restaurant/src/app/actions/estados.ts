"use server";

import {
  ensureIngresoPedidoEntregado,
  ensureIngresoReservaEntregada,
} from "@/lib/data/ingreso-entrega";
import type { PedidoUi } from "@/lib/data/pedidos";
import type { EstadoFlujo } from "@/lib/estados";
import { notifyEstadoPedido, notifyEstadoReserva } from "@/lib/mail";
import { getSession } from "@/lib/session-server";
import { createClient } from "@/lib/supabase/server";

function mapPedidoUi(
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
    modoEntrega: String(p.modo_entrega || "retiro"),
    metodoPago: (p.metodo_pago as string) || null,
    estado: String(p.estado || "recibido"),
    estadoPago: String(p.estado_pago || "pendiente"),
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

/**
 * Cambia estado de pedido (staff) + email al cliente (Resend o mock).
 * El falló de mail no revierte el UPDATE.
 */
export async function patchEstadoPedido(
  id: string,
  estado: EstadoFlujo,
  motivo?: string
): Promise<{ ok: true; pedido: PedidoUi } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "No autenticado" };

    const supabase = await createClient();
    const { data: prev, error: e0 } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", id)
      .single();
    if (e0 || !prev) {
      return { ok: false, error: e0?.message || "Pedido no encontrado" };
    }

    const { data, error } = await supabase
      .from("pedidos")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message || "No se pudo actualizar" };
    }

    await supabase.from("estado_historial").insert({
      entidad: "pedido",
      entidad_id: id,
      estado_anterior: prev.estado,
      estado_nuevo: estado,
      usuario_id: session.id,
      motivo: motivo ?? null,
    });

    if (estado === "entregado") {
      try {
        const row = data as {
          id: string;
          codigo: string;
          total: number;
          subtotal: number;
          costo_envio: number;
          estado_pago: string;
          metodo_pago: string | null;
        };
        await ensureIngresoPedidoEntregado(supabase, row, session.id);
      } catch (e) {
        console.error("[finanzas:estado_pedido]", e);
      }
    }

    const { data: items } = await supabase
      .from("pedido_items")
      .select("*")
      .eq("pedido_id", id);

    const pedido = mapPedidoUi(
      data as unknown as Record<string, unknown>,
      (items || []) as unknown as Array<Record<string, unknown>>
    );

    try {
      await notifyEstadoPedido(
        {
          id: pedido.id,
          codigo: pedido.codigo,
          clienteNombre: pedido.clienteNombre,
          fechaEntrega: pedido.fechaEntrega,
          total: Math.round(Number(pedido.total) || 0),
          estado: pedido.estado,
          modoEntrega: pedido.modoEntrega,
          canal: pedido.canal,
        },
        pedido.clienteEmail,
        motivo
      );
    } catch (e) {
      console.error("[mail:estado_pedido]", e);
    }

    return { ok: true, pedido };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo actualizar el estado",
    };
  }
}

/**
 * Cambia estado de reserva (staff) + email al cliente (Resend o mock).
 */
export async function patchEstadoReserva(
  id: string,
  estado: EstadoFlujo,
  motivo?: string
): Promise<
  | { ok: true; reserva: Record<string, unknown> }
  | { ok: false; error: string }
> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "No autenticado" };

    const supabase = await createClient();
    const { data: prev, error: e0 } = await supabase
      .from("reservas")
      .select("*")
      .eq("id", id)
      .single();
    if (e0 || !prev) {
      return { ok: false, error: e0?.message || "Reserva no encontrada" };
    }

    const { data, error } = await supabase
      .from("reservas")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message || "No se pudo actualizar" };
    }

    await supabase.from("estado_historial").insert({
      entidad: "reserva",
      entidad_id: id,
      estado_anterior: prev.estado,
      estado_nuevo: estado,
      usuario_id: session.id,
      motivo: motivo ?? null,
    });

    if (estado === "entregado") {
      try {
        const row = data as {
          id: string;
          codigo: string;
          total: number;
          anticipo: number;
          estado_anticipo: string;
          metodo_pago: string | null;
        };
        await ensureIngresoReservaEntregada(supabase, row, session.id);
      } catch (e) {
        console.error("[finanzas:estado_reserva]", e);
      }
    }

    try {
      const row = data as unknown as {
        id: string;
        codigo: string;
        cliente_nombre: string | null;
        cliente_email: string | null;
        fecha_reserva: string;
        total: number;
        anticipo: number;
        estado: string;
        estado_anticipo?: string | null;
        modo_entrega?: string | null;
      };
      await notifyEstadoReserva(
        {
          id: String(row.id),
          codigo: String(row.codigo),
          clienteNombre: String(row.cliente_nombre || "Cliente"),
          fechaEntrega: String(row.fecha_reserva || ""),
          total: Math.round(Number(row.total) || 0),
          anticipoMonto: Math.round(Number(row.anticipo) || 0),
          estado: String(row.estado),
          estadoAnticipo: row.estado_anticipo ?? null,
          modoEntrega: row.modo_entrega || "retiro",
        },
        row.cliente_email,
        motivo
      );
    } catch (e) {
      console.error("[mail:estado_reserva]", e);
    }

    return { ok: true, reserva: data as unknown as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo actualizar el estado",
    };
  }
}
