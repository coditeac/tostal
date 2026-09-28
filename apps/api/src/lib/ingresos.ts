import { sqlAll, sqlGet, sqlRun } from "./db";
import { ensureSeed } from "./seed";
import { id } from "./id";
import { hoyISO, sumarDias } from "./utils";

async function boot() {
  await ensureSeed();
}

export const CATEGORIAS_INGRESO = [
  "ventas",
  "anticipos",
  "otros",
] as const;

export type CategoriaIngreso = (typeof CATEGORIAS_INGRESO)[number];

export type Ingreso = {
  id: string;
  categoria: string;
  monto: number;
  fecha: string;
  metodoPago: string | null;
  notas: string | null;
  pedidoId: string | null;
  reservaId: string | null;
  creadoEn: string;
};

export async function listIngresos(opts?: {
  desde?: string;
  hasta?: string;
  categoria?: string;
}): Promise<Ingreso[]> {
  await boot();
  let sql = `
    SELECT id, categoria, monto, fecha, metodo_pago as metodoPago, notas,
           pedido_id as pedidoId, reserva_id as reservaId, creado_en as creadoEn
    FROM ingresos WHERE 1=1`;
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
  return sqlAll<Ingreso>(sql, ...params);
}

export async function crearIngreso(input: {
  categoria: string;
  monto: number;
  fecha: string;
  metodoPago?: string | null;
  notas?: string | null;
  pedidoId?: string | null;
  reservaId?: string | null;
}): Promise<Ingreso> {
  await boot();
  const iid = id();
  const now = new Date().toISOString();
  await sqlRun(
    `INSERT INTO ingresos
     (id, categoria, monto, fecha, metodo_pago, notas, pedido_id, reserva_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    iid,
    input.categoria,
    input.monto,
    input.fecha,
    input.metodoPago || null,
    input.notas || null,
    input.pedidoId || null,
    input.reservaId || null,
    now
  );
  return (await listIngresos()).find((g) => g.id === iid)!;
}

export async function eliminarIngreso(ingresoId: string) {
  await boot();
  await sqlRun(`DELETE FROM ingresos WHERE id = ?`, ingresoId);
}

export async function resumenIngresos(opts?: {
  desde?: string;
  hasta?: string;
}) {
  await boot();
  const desde = opts?.desde || sumarDias(hoyISO(), -30);
  const hasta = opts?.hasta || hoyISO();
  const ingresos = await listIngresos({ desde, hasta });
  const porCategoria: Record<string, number> = {};
  let total = 0;
  for (const g of ingresos) {
    total += g.monto;
    porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.monto;
  }

  const ventasPedidosRow = await sqlGet<{ t: number }>(
    `SELECT COALESCE(SUM(total), 0) as t FROM pedidos
     WHERE fecha_entrega >= ? AND fecha_entrega <= ?
       AND estado != 'cancelado'
       AND estado_pago IN ('pagado', 'contra_entrega')`,
    desde,
    hasta
  );
  const anticiposReservasRow = await sqlGet<{ t: number }>(
    `SELECT COALESCE(SUM(anticipo_monto), 0) as t FROM reservas
     WHERE fecha_entrega >= ? AND fecha_entrega <= ?
       AND estado != 'cancelada'
       AND estado_anticipo = 'pagado'`,
    desde,
    hasta
  );

  return {
    desde,
    hasta,
    total,
    porCategoria: Object.entries(porCategoria)
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto),
    ventasPedidos: ventasPedidosRow?.t ?? 0,
    anticiposReservas: anticiposReservasRow?.t ?? 0,
  };
}
