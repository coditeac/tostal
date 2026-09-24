import { sqlAll, sqlGet, sqlRun, sqlTransaction } from "./db";
import { ensureSeed } from "./seed";
import { listInsumos } from "./catalogo";
import { id } from "./utils";
import type { TipoMovimiento } from "../../../../shared/types";

async function boot() {
  await ensureSeed();
}

export type Movimiento = {
  id: string;
  insumoId: string;
  insumoNombre: string;
  unidad: string;
  tipo: TipoMovimiento;
  cantidad: number;
  costoUnitario: number | null;
  motivo: string | null;
  pedidoId: string | null;
  creadoEn: string;
};

export async function listMovimientos(opts?: {
  insumoId?: string;
  limit?: number;
}): Promise<Movimiento[]> {
  await boot();
  let sql = `
    SELECT m.id, m.insumo_id as insumoId, i.nombre as insumoNombre, i.unidad,
           m.tipo, m.cantidad, m.costo_unitario as costoUnitario, m.motivo,
           m.pedido_id as pedidoId, m.creado_en as creadoEn
    FROM movimientos_inventario m
    JOIN insumos i ON i.id = m.insumo_id
    WHERE 1=1`;
  const params: Array<string | number> = [];
  if (opts?.insumoId) {
    sql += ` AND m.insumo_id = ?`;
    params.push(opts.insumoId);
  }
  sql += ` ORDER BY m.creado_en DESC LIMIT ?`;
  params.push(opts?.limit ?? 80);
  return sqlAll<Movimiento>(sql, ...params);
}

export async function alertasStock() {
  await boot();
  return (await listInsumos())
    .filter((i) => i.stockActual <= i.stockMinimo)
    .map((i) => ({
      ...i,
      faltante: Math.max(0, i.stockMinimo - i.stockActual),
      critico: i.stockActual <= 0,
    }));
}

export async function registrarMovimiento(input: {
  insumoId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo?: string | null;
  usuarioId?: string | null;
  pedidoId?: string | null;
  actualizarCosto?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await boot();
  if (!input.cantidad || input.cantidad <= 0) {
    return { ok: false, error: "La cantidad debe ser mayor a 0." };
  }
  const insumo = await sqlGet<{
    id: string;
    stock_actual: number;
    costo_unitario: number;
  }>(
    `SELECT id, stock_actual, costo_unitario FROM insumos WHERE id = ?`,
    input.insumoId
  );
  if (!insumo) return { ok: false, error: "Insumo no encontrado." };

  const esEntrada =
    input.tipo === "entrada" ||
    (input.tipo === "ajuste" && input.motivo?.startsWith("+"));
  // Convención: entrada/ajuste+ suman; salida/merma/produccion/ajuste− restan
  let delta = input.cantidad;
  if (
    input.tipo === "salida" ||
    input.tipo === "merma" ||
    input.tipo === "produccion"
  ) {
    delta = -input.cantidad;
  } else if (input.tipo === "ajuste") {
    // ajuste: cantidad es el nuevo stock absoluto si motivo es "set", si no delta con signo en motivo
    if (input.motivo === "set") {
      delta = input.cantidad - insumo.stock_actual;
    } else if (!esEntrada && input.motivo?.startsWith("-")) {
      delta = -input.cantidad;
    }
  }

  const nuevoStock = insumo.stock_actual + delta;
  if (nuevoStock < -0.0001) {
    return { ok: false, error: "No hay stock suficiente." };
  }

  const now = new Date().toISOString();
  await sqlTransaction(async () => {
    await sqlRun(
      `UPDATE insumos SET stock_actual = ? WHERE id = ?`,
      Math.max(0, nuevoStock),
      input.insumoId
    );
    if (
      input.actualizarCosto != null &&
      input.actualizarCosto >= 0 &&
      (input.tipo === "entrada" || input.tipo === "ajuste")
    ) {
      await sqlRun(
        `UPDATE insumos SET costo_unitario = ? WHERE id = ?`,
        input.actualizarCosto,
        input.insumoId
      );
    }
    await sqlRun(
      `INSERT INTO movimientos_inventario
       (id, insumo_id, tipo, cantidad, costo_unitario, motivo, pedido_id, usuario_id, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id(),
      input.insumoId,
      input.tipo,
      Math.abs(delta),
      input.actualizarCosto ?? insumo.costo_unitario,
      input.motivo || null,
      input.pedidoId || null,
      input.usuarioId || null,
      now
    );
  });
  return { ok: true };
}
