import { getDb } from "./db";
import { ensureSeed } from "./seed";
import { listInsumos } from "./catalogo";
import { id } from "./utils";
import type { TipoMovimiento } from "../../../../shared/types";

function boot() {
  ensureSeed();
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

export function listMovimientos(opts?: {
  insumoId?: string;
  limit?: number;
}): Movimiento[] {
  boot();
  let sql = `
    SELECT m.id, m.insumo_id as insumoId, i.nombre as insumoNombre, i.unidad,
           m.tipo, m.cantidad, m.costo_unitario as costoUnitario, m.motivo,
           m.pedido_id as pedidoId, m.creado_en as creadoEn
    FROM movimientos_inventario m
    JOIN insumos i ON i.id = m.insumo_id
    WHERE 1=1`;
  const params: string[] = [];
  if (opts?.insumoId) {
    sql += ` AND m.insumo_id = ?`;
    params.push(opts.insumoId);
  }
  sql += ` ORDER BY m.creado_en DESC LIMIT ?`;
  params.push(String(opts?.limit ?? 80));
  return getDb().prepare(sql).all(...params) as Movimiento[];
}

export function alertasStock() {
  boot();
  return listInsumos()
    .filter((i) => i.stockActual <= i.stockMinimo)
    .map((i) => ({
      ...i,
      faltante: Math.max(0, i.stockMinimo - i.stockActual),
      critico: i.stockActual <= 0,
    }));
}

export function registrarMovimiento(input: {
  insumoId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo?: string | null;
  usuarioId?: string | null;
  pedidoId?: string | null;
  actualizarCosto?: number | null;
}): { ok: true } | { ok: false; error: string } {
  boot();
  if (!input.cantidad || input.cantidad <= 0) {
    return { ok: false, error: "La cantidad debe ser mayor a 0." };
  }
  const db = getDb();
  const insumo = db
    .prepare(`SELECT id, stock_actual, costo_unitario FROM insumos WHERE id = ?`)
    .get(input.insumoId) as
    | { id: string; stock_actual: number; costo_unitario: number }
    | undefined;
  if (!insumo) return { ok: false, error: "Insumo no encontrado." };

  const entradas: TipoMovimiento[] = ["entrada", "ajuste"];
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
  const tx = db.transaction(() => {
    db.prepare(`UPDATE insumos SET stock_actual = ? WHERE id = ?`).run(
      Math.max(0, nuevoStock),
      input.insumoId
    );
    if (
      input.actualizarCosto != null &&
      input.actualizarCosto >= 0 &&
      (input.tipo === "entrada" || input.tipo === "ajuste")
    ) {
      db.prepare(`UPDATE insumos SET costo_unitario = ? WHERE id = ?`).run(
        input.actualizarCosto,
        input.insumoId
      );
    }
    db.prepare(
      `INSERT INTO movimientos_inventario
       (id, insumo_id, tipo, cantidad, costo_unitario, motivo, pedido_id, usuario_id, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
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
  tx();
  return { ok: true };
}
