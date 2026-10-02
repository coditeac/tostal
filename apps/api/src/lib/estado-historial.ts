/**
 * Historial de cambios de estado (pedidos y reservaciones).
 */
import { sqlAll, sqlRun } from "./db";
import { id } from "./id";
import type { EstadoHistorialEntry } from "./estados";

export async function appendEstadoHistorial(opts: {
  entidadTipo: "pedido" | "reserva";
  entidadId: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  motivo?: string | null;
  usuarioId?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await sqlRun(
    `INSERT INTO estado_historial
     (id, entidad_tipo, entidad_id, estado_anterior, estado_nuevo, motivo, usuario_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id(),
    opts.entidadTipo,
    opts.entidadId,
    opts.estadoAnterior,
    opts.estadoNuevo,
    opts.motivo || null,
    opts.usuarioId || null,
    now
  );
}

export async function listEstadoHistorial(
  entidadTipo: "pedido" | "reserva",
  entidadId: string
): Promise<EstadoHistorialEntry[]> {
  const rows = await sqlAll<{
    id: string;
    estado_anterior: string | null;
    estado_nuevo: string;
    motivo: string | null;
    usuario_id: string | null;
    creado_en: string;
  }>(
    `SELECT id, estado_anterior, estado_nuevo, motivo, usuario_id, creado_en
     FROM estado_historial
     WHERE entidad_tipo = ? AND entidad_id = ?
     ORDER BY creado_en ASC`,
    entidadTipo,
    entidadId
  );
  return rows.map((r) => ({
    id: r.id,
    estadoAnterior: r.estado_anterior,
    estadoNuevo: r.estado_nuevo,
    motivo: r.motivo,
    usuarioId: r.usuario_id,
    creadoEn: r.creado_en,
  }));
}
