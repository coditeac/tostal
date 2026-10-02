import { sqlAll, sqlGet, sqlRun, sqlTransaction } from "./db";
import { ensureSeed } from "./seed";
import { getConfigPublica } from "./config";
import {
  calcularAnticipoUnitario,
  getProducto,
  getReceta,
  listInsumos,
  listProductos,
  listZonas,
} from "./catalogo";
import { id } from "./id";
import type { LineaPedidoInput, MetodoPago, ModoEntrega } from "../../../../shared/types";
import type {
  EstadoAnticipo,
  EstadoReserva,
  ProductoReservaPublico,
  ReservaNecesidad,
  ReservaPublica,
} from "./domain-types";

async function boot() {
  await ensureSeed();
}

function codigoReserva(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `R-${mm}${dd}-${n}`;
}

export async function listProductosReserva(): Promise<ProductoReservaPublico[]> {
  await boot();
  const { hoyISO, sumarDias } = await import("./utils");
  const hoy = hoyISO();
  return (await listProductos())
    .filter((p) => p.activoCatalogo && p.reservaHabilitada)
    .map((p) => {
      const dias = p.reservaDiasMinimos;
      const qtyMin = p.reservaCantidadMinima;
      const fechaMinima = sumarDias(hoy, dias);
      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        categoriaId: p.categoriaId,
        categoriaNombre: p.categoriaNombre,
        alergenos: p.alergenos,
        fotoUrl: p.fotoUrl,
        anticipoTipo: p.anticipoTipo,
        anticipoValor: p.anticipoValor,
        anticipoUnitario: calcularAnticipoUnitario(
          p.precio,
          p.anticipoTipo,
          p.anticipoValor
        ),
        reservaDiasMinimos: dias,
        reservaCantidadMinima: qtyMin,
        reserva_dias_minimos: dias,
        reserva_cantidad_minima: qtyMin,
        fecha_minima: fechaMinima,
      };
    });
}

async function mapReserva(row: Record<string, unknown>): Promise<ReservaPublica> {
  const lineas = await sqlAll<ReservaPublica["lineas"][number]>(
    `SELECT id, producto_id as productoId, producto_nombre as productoNombre,
            cantidad, precio_unitario as precioUnitario, subtotal, notas
     FROM reserva_lineas WHERE reserva_id = ?`,
    row.id as string
  );
  return {
    id: row.id as string,
    codigo: row.codigo as string,
    estado: row.estado as EstadoReserva,
    estadoAnticipo: row.estado_anticipo as EstadoAnticipo,
    metodoPago: row.metodo_pago as MetodoPago,
    modoEntrega: row.modo_entrega as ModoEntrega,
    fechaEntrega: row.fecha_entrega as string,
    clienteNombre: row.cliente_nombre as string,
    clienteTelefono: row.cliente_telefono as string,
    subtotal: row.subtotal as number,
    anticipoMonto: row.anticipo_monto as number,
    costoEnvio: row.costo_envio as number,
    total: row.total as number,
    notas: (row.notas as string) || null,
    creadoEn: row.creado_en as string,
    lineas,
  };
}

export async function getReserva(
  reservaIdOrCodigo: string
): Promise<ReservaPublica | null> {
  await boot();
  const row = await sqlGet<Record<string, unknown>>(
    `SELECT * FROM reservas WHERE id = ? OR codigo = ?`,
    reservaIdOrCodigo,
    reservaIdOrCodigo
  );
  if (!row) return null;
  return mapReserva(row);
}

export async function listReservas(opts?: {
  fecha?: string;
  estado?: string;
}): Promise<
  Array<
    ReservaPublica & {
      necesidades: ReservaNecesidad[];
      requiereCompra: boolean;
    }
  >
> {
  await boot();
  let sql = `SELECT * FROM reservas WHERE 1=1`;
  const params: string[] = [];
  if (opts?.fecha) {
    sql += ` AND fecha_entrega = ?`;
    params.push(opts.fecha);
  }
  if (opts?.estado) {
    sql += ` AND estado = ?`;
    params.push(opts.estado);
  }
  sql += ` ORDER BY fecha_entrega ASC, creado_en DESC`;
  const rows = await sqlAll<Record<string, unknown>>(sql, ...params);
  const out = [];
  for (const row of rows) {
    const reserva = await mapReserva(row);
    const necesidades = await getNecesidades(reserva.id);
    out.push({
      ...reserva,
      necesidades,
      requiereCompra: necesidades.some((n) => n.requiereCompra),
    });
  }
  return out;
}

export async function getNecesidades(
  reservaId: string
): Promise<ReservaNecesidad[]> {
  await boot();
  const rows = await sqlAll<{
    id: string;
    reservaId: string;
    insumoId: string;
    insumoNombre: string;
    unidad: ReservaNecesidad["unidad"];
    cantidadNecesaria: number;
    stockActual: number;
    faltante: number;
    requiereCompra: number;
  }>(
    `SELECT id, reserva_id as reservaId, insumo_id as insumoId,
            insumo_nombre as insumoNombre, unidad,
            cantidad_necesaria as cantidadNecesaria,
            stock_actual as stockActual, faltante,
            requiere_compra as requiereCompra
     FROM reserva_necesidades WHERE reserva_id = ?
     ORDER BY requiere_compra DESC, insumo_nombre`,
    reservaId
  );
  return rows.map((r) => ({
    ...r,
    requiereCompra: !!r.requiereCompra,
  }));
}

/** Explosión de materiales (BOM) vs inventario → necesidades + flag compra. */
async function generarNecesidades(
  reservaId: string,
  lineas: Array<{ productoId: string; cantidad: number }>
): Promise<void> {
  const insumos = Object.fromEntries(
    (await listInsumos()).map((i) => [i.id, i])
  );
  const acumulado = new Map<
    string,
    { cantidad: number; nombre: string; unidad: string }
  >();

  for (const linea of lineas) {
    const receta = await getReceta(linea.productoId);
    for (const r of receta) {
      const prev = acumulado.get(r.insumoId);
      const add = r.cantidad * linea.cantidad;
      if (prev) {
        prev.cantidad += add;
      } else {
        const ins = insumos[r.insumoId];
        acumulado.set(r.insumoId, {
          cantidad: add,
          nombre: ins?.nombre || r.insumoNombre || r.insumoId,
          unidad: ins?.unidad || r.unidad || "u",
        });
      }
    }
  }

  await sqlRun(`DELETE FROM reserva_necesidades WHERE reserva_id = ?`, reservaId);

  for (const [insumoId, data] of acumulado) {
    const stock = insumos[insumoId]?.stockActual ?? 0;
    const faltante = Math.max(0, data.cantidad - stock);
    const requiereCompra = faltante > 0 ? 1 : 0;
    await sqlRun(
      `INSERT INTO reserva_necesidades
       (id, reserva_id, insumo_id, insumo_nombre, unidad, cantidad_necesaria, stock_actual, faltante, requiere_compra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id(),
      reservaId,
      insumoId,
      data.nombre,
      data.unidad,
      data.cantidad,
      stock,
      faltante,
      requiereCompra
    );
  }
}

export async function crearReserva(input: {
  fechaEntrega: string;
  modoEntrega: ModoEntrega;
  zonaId?: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail?: string | null;
  cuentaClienteId?: string | null;
  direccion?: string | null;
  metodoPago: MetodoPago;
  notas?: string | null;
  lineas: LineaPedidoInput[];
}): Promise<{ ok: true; reserva: ReservaPublica } | { ok: false; error: string }> {
  await boot();
  const config = await getConfigPublica();
  if (!config.canalRemotoActivo) {
    return { ok: false, error: "El canal remoto está desactivado." };
  }

  const { getCheckoutPolicy } = await import("./cliente-auth");
  const policy = await getCheckoutPolicy();
  if (policy.requiereCuenta && !input.cuentaClienteId) {
    return {
      ok: false,
      error: "Inicia sesión o crea una cuenta para reservar.",
    };
  }

  const emailNorm = input.clienteEmail?.trim().toLowerCase() || null;
  if (!input.cuentaClienteId && !emailNorm) {
    return {
      ok: false,
      error: "Indica un email (o inicia sesión) para confirmar tu reserva.",
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fechaEntrega)) {
    return { ok: false, error: "Fecha de reserva inválida." };
  }

  if (!input.clienteNombre?.trim() || !input.clienteTelefono?.trim()) {
    return { ok: false, error: "Nombre y teléfono son obligatorios." };
  }

  if (!input.lineas?.length) {
    return { ok: false, error: "Elige al menos un producto para reservar." };
  }

  const metodosOk: MetodoPago[] = ["transferencia", "stripe"];
  if (!metodosOk.includes(input.metodoPago)) {
    return {
      ok: false,
      error: "Para reservas elige transferencia o pago en línea (anticipo).",
    };
  }

  const { hoyISO, sumarDias } = await import("./utils");
  const hoyIso = hoyISO();

  let subtotal = 0;
  let anticipoMonto = 0;
  let diasMinimosPedido = 0;
  let productoRestrictivoDias: string | null = null;
  const lineasResueltas: Array<{
    productoId: string;
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    notas: string | null;
  }> = [];

  for (const l of input.lineas) {
    if (!Number.isFinite(l.cantidad) || l.cantidad < 1) {
      return { ok: false, error: "Cantidad inválida." };
    }
    const prod = await getProducto(l.productoId);
    if (!prod || !prod.activoCatalogo) {
      return { ok: false, error: "Producto no disponible." };
    }
    if (!prod.reservaHabilitada) {
      return {
        ok: false,
        error: `${prod.nombre} no admite reserva bajo pedido.`,
      };
    }

    const qtyMin = prod.reservaCantidadMinima;
    if (l.cantidad < qtyMin) {
      return {
        ok: false,
        error: `La cantidad mínima para ${prod.nombre} es ${qtyMin}.`,
      };
    }

    if (prod.reservaDiasMinimos > diasMinimosPedido) {
      diasMinimosPedido = prod.reservaDiasMinimos;
      productoRestrictivoDias = prod.nombre;
    }

    const sub = prod.precio * l.cantidad;
    subtotal += sub;
    anticipoMonto +=
      calcularAnticipoUnitario(prod.precio, prod.anticipoTipo, prod.anticipoValor) *
      l.cantidad;
    lineasResueltas.push({
      productoId: prod.id,
      productoNombre: prod.nombre,
      cantidad: l.cantidad,
      precioUnitario: prod.precio,
      subtotal: sub,
      notas: l.notas || null,
    });
  }

  const fechaMinima = sumarDias(hoyIso, diasMinimosPedido);
  if (input.fechaEntrega < fechaMinima) {
    const nombre = productoRestrictivoDias
      ? ` de ${productoRestrictivoDias}`
      : "";
    return {
      ok: false,
      error:
        diasMinimosPedido <= 0
          ? `La fecha de reserva no puede ser anterior a hoy (${fechaMinima}).`
          : `La reserva${nombre} requiere al menos ${diasMinimosPedido} día${diasMinimosPedido === 1 ? "" : "s"} de anticipación. La fecha mínima es ${fechaMinima}.`,
    };
  }

  if (anticipoMonto <= 0) {
    anticipoMonto = Math.max(1, Math.round(subtotal * 0.5));
  }
  if (anticipoMonto > subtotal) anticipoMonto = subtotal;

  let costoEnvio = 0;
  if (input.modoEntrega === "envio") {
    if (!input.zonaId) {
      return { ok: false, error: "Elige una zona de envío." };
    }
    const zona = (await listZonas()).find(
      (z) => z.id === input.zonaId && z.activa
    );
    if (!zona) {
      return {
        ok: false,
        error: "Tu zona no está cubierta. Puedes retirar en tienda.",
      };
    }
    if (!input.direccion?.trim()) {
      return { ok: false, error: "Indica la dirección de envío." };
    }
    costoEnvio = zona.costoEnvio;
  }

  const now = new Date().toISOString();
  const reservaId = id();
  const codigo = codigoReserva();
  const total = subtotal + costoEnvio;
  // Transferencia/Stripe: anticipo pendiente hasta confirmar pago.
  const estadoAnticipo: EstadoAnticipo = "pendiente";
  const estado: EstadoReserva = "pendiente_anticipo";

  await sqlTransaction(async () => {
    let clienteId: string | null = null;
    const existente = await sqlGet<{ id: string }>(
      `SELECT id FROM clientes WHERE telefono = ?`,
      input.clienteTelefono.trim()
    );
    if (existente) {
      clienteId = existente.id;
      await sqlRun(
        `UPDATE clientes SET nombre = ? WHERE id = ?`,
        input.clienteNombre.trim(),
        clienteId
      );
    } else {
      clienteId = id();
      await sqlRun(
        `INSERT INTO clientes (id, nombre, telefono, email, notas, creado_en)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        clienteId,
        input.clienteNombre.trim(),
        input.clienteTelefono.trim(),
        emailNorm,
        now
      );
    }

    await sqlRun(
      `INSERT INTO reservas (
         id, codigo, estado, estado_anticipo, metodo_pago, modo_entrega,
         fecha_entrega, zona_id, cliente_id, cuenta_cliente_id,
         cliente_nombre, cliente_telefono, cliente_email, direccion,
         subtotal, anticipo_monto, costo_envio, total, notas, creado_en, actualizado_en
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reservaId,
      codigo,
      estado,
      estadoAnticipo,
      input.metodoPago,
      input.modoEntrega,
      input.fechaEntrega,
      input.zonaId || null,
      clienteId,
      input.cuentaClienteId || null,
      input.clienteNombre.trim(),
      input.clienteTelefono.trim(),
      emailNorm,
      input.direccion?.trim() || null,
      subtotal,
      anticipoMonto,
      costoEnvio,
      total,
      input.notas?.trim() || null,
      now,
      now
    );

    for (const l of lineasResueltas) {
      await sqlRun(
        `INSERT INTO reserva_lineas
         (id, reserva_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id(),
        reservaId,
        l.productoId,
        l.productoNombre,
        l.cantidad,
        l.precioUnitario,
        l.subtotal,
        l.notas
      );
    }

    await generarNecesidades(
      reservaId,
      lineasResueltas.map((l) => ({
        productoId: l.productoId,
        cantidad: l.cantidad,
      }))
    );
  });

  const reserva = (await getReserva(reservaId))!;
  const { notifyReservaCreada } = await import("./mail");
  await notifyReservaCreada(reserva, emailNorm);

  return { ok: true, reserva };
}

export async function actualizarEstadoReserva(
  reservaId: string,
  estado: EstadoReserva
): Promise<ReservaPublica | null> {
  await boot();
  const now = new Date().toISOString();
  await sqlRun(
    `UPDATE reservas SET estado = ?, actualizado_en = ? WHERE id = ? OR codigo = ?`,
    estado,
    now,
    reservaId,
    reservaId
  );
  return getReserva(reservaId);
}

export async function confirmarAnticipoReserva(
  reservaId: string
): Promise<ReservaPublica | null> {
  await boot();
  const existing = await getReserva(reservaId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const nuevoEstado: EstadoReserva =
    existing.estado === "pendiente_anticipo" ? "confirmada" : existing.estado;
  await sqlRun(
    `UPDATE reservas SET estado_anticipo = 'pagado', estado = ?, actualizado_en = ?
     WHERE id = ? OR codigo = ?`,
    nuevoEstado,
    now,
    reservaId,
    reservaId
  );
  const reserva = await getReserva(reservaId);
  if (reserva) {
    const { notifyAnticipoConfirmado } = await import("./mail");
    const emailRow = await sqlGet<{ cliente_email: string | null }>(
      `SELECT cliente_email FROM reservas WHERE id = ?`,
      reserva.id
    );
    await notifyAnticipoConfirmado(reserva, emailRow?.cliente_email || null);
  }
  return reserva;
}

/** Agrega insumos que requieren compra a una lista sugerida editable. */
export async function sugerirComprasDesdeReservas(fecha?: string): Promise<{
  items: Array<{
    insumoId: string;
    insumoNombre: string;
    unidad: string;
    cantidadFaltante: number;
    reservas: string[];
  }>;
}> {
  await boot();
  const { isPostgres } = await import("./db");
  const agg = isPostgres()
    ? `STRING_AGG(DISTINCT r.codigo, ',')`
    : `GROUP_CONCAT(DISTINCT r.codigo)`;

  let sql = `
    SELECT n.insumo_id as insumoId, n.insumo_nombre as insumoNombre, n.unidad,
           SUM(n.faltante) as cantidadFaltante,
           ${agg} as codigos
    FROM reserva_necesidades n
    JOIN reservas r ON r.id = n.reserva_id
    WHERE n.requiere_compra = 1
      AND r.estado NOT IN ('cancelada', 'entregada')
  `;
  const params: string[] = [];
  if (fecha) {
    sql += ` AND r.fecha_entrega = ?`;
    params.push(fecha);
  }
  sql += ` GROUP BY n.insumo_id, n.insumo_nombre, n.unidad ORDER BY n.insumo_nombre`;

  const rows = await sqlAll<{
    insumoId: string;
    insumoNombre: string;
    unidad: string;
    cantidadFaltante: number;
    codigos: string | null;
  }>(sql, ...params);

  return {
    items: rows.map((r) => ({
      insumoId: r.insumoId,
      insumoNombre: r.insumoNombre,
      unidad: r.unidad,
      cantidadFaltante: Number(r.cantidadFaltante) || 0,
      reservas: (r.codigos || "").split(",").filter(Boolean),
    })),
  };
}
