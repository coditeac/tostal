import { sqlAll, sqlGet, sqlRun } from "./db";
import { ensureSeed } from "./seed";
import { id, hoyISO, sumarDias } from "./utils";

async function boot() {
  await ensureSeed();
}

export const CATEGORIAS_GASTO = [
  "insumos",
  "empaque",
  "delivery",
  "servicios",
  "marketing",
  "herramientas",
  "otros",
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export type Gasto = {
  id: string;
  categoria: string;
  monto: number;
  fecha: string;
  metodoPago: string | null;
  notas: string | null;
  comprobante: string | null;
  compraId: string | null;
  creadoEn: string;
};

export async function listGastos(opts?: {
  desde?: string;
  hasta?: string;
  categoria?: string;
}): Promise<Gasto[]> {
  await boot();
  let sql = `
    SELECT id, categoria, monto, fecha, metodo_pago as metodoPago, notas,
           comprobante, compra_id as compraId, creado_en as creadoEn
    FROM gastos WHERE 1=1`;
  const params: string[] = [];
  if (opts?.desde) {
    sql += ` AND fecha >= ?`;
    params.push(opts.desde);
  }
  if (opts?.hasta) {
    sql += ` AND fecha <= ?`;
    params.push(opts.hasta);
  }
  if (opts?.categoria) {
    sql += ` AND categoria = ?`;
    params.push(opts.categoria);
  }
  sql += ` ORDER BY fecha DESC, creado_en DESC`;
  return sqlAll<Gasto>(sql, ...params);
}

export async function crearGasto(input: {
  categoria: string;
  monto: number;
  fecha: string;
  metodoPago?: string | null;
  notas?: string | null;
  comprobante?: string | null;
  compraId?: string | null;
}): Promise<Gasto> {
  await boot();
  const gid = id();
  const now = new Date().toISOString();
  await sqlRun(
    `INSERT INTO gastos (id, categoria, monto, fecha, metodo_pago, notas, creado_en, comprobante, compra_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    gid,
    input.categoria,
    input.monto,
    input.fecha,
    input.metodoPago || null,
    input.notas || null,
    now,
    input.comprobante || null,
    input.compraId || null
  );
  return (await listGastos()).find((g) => g.id === gid)!;
}

export async function eliminarGasto(gastoId: string) {
  await boot();
  await sqlRun(`DELETE FROM gastos WHERE id = ?`, gastoId);
}

export async function resumenGastos(opts?: {
  desde?: string;
  hasta?: string;
}) {
  await boot();
  const desde = opts?.desde || sumarDias(hoyISO(), -30);
  const hasta = opts?.hasta || hoyISO();
  const gastos = await listGastos({ desde, hasta });
  const porCategoria: Record<string, number> = {};
  let total = 0;
  for (const g of gastos) {
    total += g.monto;
    porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.monto;
  }

  const ventasRow = await sqlGet<{ t: number }>(
    `SELECT COALESCE(SUM(total), 0) as t FROM pedidos
     WHERE fecha_entrega >= ? AND fecha_entrega <= ?
       AND estado != 'cancelado'
       AND estado_pago IN ('pagado', 'contra_entrega')`,
    desde,
    hasta
  );
  const ventas = ventasRow?.t ?? 0;

  return {
    desde,
    hasta,
    total,
    porCategoria: Object.entries(porCategoria)
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto),
    ventas,
    gastosVsVentas:
      ventas > 0 ? Math.round((total / ventas) * 1000) / 10 : null,
  };
}
