import { sqlAll, sqlGet, sqlRun, sqlTransaction } from "./db";
import { ensureSeed } from "./seed";
import { getConfigPublica } from "./config";
import { getDia, getDisponibilidad, getProducto, listZonas } from "./catalogo";
import { publishPedidoEvent } from "./pedido-events";
import { id } from "./id";
import type {
  EstadoPedido,
  LineaPedidoInput,
  MetodoPago,
  ModoEntrega,
  PedidoPublico,
} from "../../../../shared/types";

async function boot() {
  await ensureSeed();
}

function codigoPedido(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `T-${mm}${dd}-${n}`;
}

export async function mapPedido(
  row: Record<string, unknown>
): Promise<PedidoPublico> {
  const lineas = await sqlAll<PedidoPublico["lineas"][number]>(
    `SELECT id, producto_id as productoId, producto_nombre as productoNombre,
            cantidad, precio_unitario as precioUnitario, subtotal, notas
     FROM pedido_lineas WHERE pedido_id = ?`,
    row.id as string
  );

  return {
    id: row.id as string,
    codigo: row.codigo as string,
    canal: row.canal as PedidoPublico["canal"],
    estado: row.estado as PedidoPublico["estado"],
    estadoPago: row.estado_pago as PedidoPublico["estadoPago"],
    metodoPago: row.metodo_pago as PedidoPublico["metodoPago"],
    modoEntrega: row.modo_entrega as PedidoPublico["modoEntrega"],
    fechaEntrega: row.fecha_entrega as string,
    clienteNombre: row.cliente_nombre as string,
    clienteTelefono: row.cliente_telefono as string,
    subtotal: row.subtotal as number,
    costoEnvio: row.costo_envio as number,
    total: row.total as number,
    notas: (row.notas as string) || null,
    creadoEn: row.creado_en as string,
    lineas,
  };
}

export async function getPedido(
  pedidoId: string
): Promise<PedidoPublico | null> {
  await boot();
  const row = await sqlGet<Record<string, unknown>>(
    `SELECT * FROM pedidos WHERE id = ? OR codigo = ?`,
    pedidoId,
    pedidoId
  );
  if (!row) return null;
  return mapPedido(row);
}

export async function listPedidos(opts?: {
  fecha?: string;
  canal?: string;
}): Promise<PedidoPublico[]> {
  await boot();
  let sql = `SELECT * FROM pedidos WHERE 1=1`;
  const params: string[] = [];
  if (opts?.fecha) {
    sql += ` AND fecha_entrega = ?`;
    params.push(opts.fecha);
  }
  if (opts?.canal) {
    sql += ` AND canal = ?`;
    params.push(opts.canal);
  }
  sql += ` ORDER BY creado_en DESC`;
  const rows = await sqlAll<Record<string, unknown>>(sql, ...params);
  return Promise.all(rows.map((r) => mapPedido(r)));
}

export async function crearPedidoRemoto(input: {
  fechaEntrega: string;
  modoEntrega: ModoEntrega;
  zonaId?: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  direccion?: string | null;
  metodoPago: MetodoPago;
  notas?: string | null;
  lineas: LineaPedidoInput[];
}): Promise<{ ok: true; pedido: PedidoPublico } | { ok: false; error: string }> {
  await boot();
  const config = await getConfigPublica();
  if (!config.canalRemotoActivo) {
    return { ok: false, error: "El canal remoto está desactivado." };
  }
  const dia = await getDia(input.fechaEntrega);
  if (!dia || !dia.abierto) {
    return { ok: false, error: "Ese día no está abierto para pedidos." };
  }
  if (new Date() >= new Date(dia.deadlinePedido)) {
    return {
      ok: false,
      error: "Ya cerramos pedidos para este día.",
    };
  }
  if (!input.lineas.length) {
    return { ok: false, error: "El carrito está vacío." };
  }

  const disp = Object.fromEntries(
    (await getDisponibilidad(input.fechaEntrega)).map((d) => [
      d.productoId,
      d.disponible,
    ])
  );

  let subtotal = 0;
  const lineasResueltas: Array<{
    productoId: string;
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    notas: string | null;
  }> = [];

  for (const l of input.lineas) {
    if (l.cantidad < 1) {
      return { ok: false, error: "Cantidad inválida." };
    }
    if (!disp[l.productoId]) {
      return {
        ok: false,
        error: "Hay productos que no están disponibles ese día.",
      };
    }
    const prod = await getProducto(l.productoId);
    if (!prod || !prod.activoCatalogo) {
      return { ok: false, error: "Producto no disponible." };
    }
    const sub = prod.precio * l.cantidad;
    subtotal += sub;
    lineasResueltas.push({
      productoId: prod.id,
      productoNombre: prod.nombre,
      cantidad: l.cantidad,
      precioUnitario: prod.precio,
      subtotal: sub,
      notas: l.notas || null,
    });
  }

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

  if (dia.cupoMaximo != null) {
    const countRow = await sqlGet<{ c: number }>(
      `SELECT COUNT(*) as c FROM pedidos
       WHERE fecha_entrega = ? AND estado != 'cancelado'`,
      input.fechaEntrega
    );
    const count = countRow?.c ?? 0;
    if (count >= dia.cupoMaximo) {
      return { ok: false, error: "Ya no hay cupo para ese día." };
    }
  }

  const metodosOk: MetodoPago[] = [
    "transferencia",
    "contra_entrega",
    "stripe",
  ];
  if (!metodosOk.includes(input.metodoPago)) {
    return { ok: false, error: "Método de pago no válido." };
  }

  let estadoPago: PedidoPublico["estadoPago"] = "pendiente";
  if (input.metodoPago === "contra_entrega") estadoPago = "contra_entrega";
  if (input.metodoPago === "stripe") {
    // Mock Stripe: marca pagado si no hay clave real
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      estadoPago = "pagado";
    } else {
      estadoPago = "pendiente";
    }
  }

  const now = new Date().toISOString();
  const pedidoId = id();
  const codigo = codigoPedido();
  const total = subtotal + costoEnvio;

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
         VALUES (?, ?, ?, NULL, NULL, ?)`,
        clienteId,
        input.clienteNombre.trim(),
        input.clienteTelefono.trim(),
        now
      );
    }

    await sqlRun(
      `INSERT INTO pedidos (
        id, codigo, canal, estado, estado_pago, metodo_pago, modo_entrega,
        fecha_entrega, zona_id, cliente_id, cliente_nombre, cliente_telefono,
        direccion, subtotal, costo_envio, total, notas, insumos_descontados,
        ficha_codigo, creado_en, actualizado_en
      ) VALUES (?, ?, 'remoto', 'recibido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
      pedidoId,
      codigo,
      estadoPago,
      input.metodoPago,
      input.modoEntrega,
      input.fechaEntrega,
      input.zonaId || null,
      clienteId,
      input.clienteNombre.trim(),
      input.clienteTelefono.trim(),
      input.direccion || null,
      subtotal,
      costoEnvio,
      total,
      input.notas || null,
      now,
      now
    );

    for (const l of lineasResueltas) {
      await sqlRun(
        `INSERT INTO pedido_lineas (id, pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id(),
        pedidoId,
        l.productoId,
        l.productoNombre,
        l.cantidad,
        l.precioUnitario,
        l.subtotal,
        l.notas
      );
    }

    // Aviso WhatsApp pendiente
    const texto = `¡Hola ${input.clienteNombre}! Recibimos tu pedido ${codigo} en Tostal para el ${input.fechaEntrega}. Total: $${(total / 100).toFixed(2)}. Te avisamos cuando lo confirmemos.`;
    await sqlRun(
      `INSERT INTO avisos_whatsapp (id, pedido_id, destinatario, telefono, evento, texto, estado, creado_en)
       VALUES (?, ?, ?, ?, 'recibido', ?, 'pendiente', ?)`,
      id(),
      pedidoId,
      input.clienteNombre.trim(),
      input.clienteTelefono.trim(),
      texto,
      now
    );
  });

  const pedido = (await getPedido(pedidoId))!;
  publishPedidoEvent("pedido_creado", pedido);
  return { ok: true, pedido };
}

export async function actualizarEstadoPedido(
  pedidoId: string,
  estado: EstadoPedido,
  usuarioId?: string
): Promise<{ ok: true; pedido: PedidoPublico } | { ok: false; error: string }> {
  await boot();
  const row = await sqlGet<Record<string, unknown>>(
    `SELECT * FROM pedidos WHERE id = ?`,
    pedidoId
  );
  if (!row) return { ok: false, error: "Pedido no encontrado." };

  const now = new Date().toISOString();

  await sqlTransaction(async () => {
    // Descuento de insumos al iniciar producción
    if (estado === "en_produccion" && !row.insumos_descontados) {
      const lineas = await sqlAll<{ productoId: string; cantidad: number }>(
        `SELECT producto_id as productoId, cantidad FROM pedido_lineas WHERE pedido_id = ?`,
        pedidoId
      );

      for (const linea of lineas) {
        const receta = await sqlAll<{
          insumoId: string;
          cantidad: number;
        }>(
          `SELECT insumo_id as insumoId, cantidad FROM receta_lineas WHERE producto_id = ?`,
          linea.productoId
        );
        for (const r of receta) {
          const qty = r.cantidad * linea.cantidad;
          await sqlRun(
            `UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?`,
            qty,
            r.insumoId
          );
          await sqlRun(
            `INSERT INTO movimientos_inventario
             (id, insumo_id, tipo, cantidad, costo_unitario, motivo, pedido_id, usuario_id, creado_en)
             VALUES (?, ?, 'produccion', ?, NULL, 'Inicio de producción', ?, ?, ?)`,
            id(),
            r.insumoId,
            qty,
            pedidoId,
            usuarioId || null,
            now
          );
        }
      }
      await sqlRun(
        `UPDATE pedidos SET insumos_descontados = 1 WHERE id = ?`,
        pedidoId
      );
    }

    await sqlRun(
      `UPDATE pedidos SET estado = ?, actualizado_en = ? WHERE id = ?`,
      estado,
      now,
      pedidoId
    );

    const textos: Record<string, string> = {
      confirmado: `Tu pedido ${row.codigo} en Tostal fue confirmado. ¡Ya lo preparamos!`,
      en_produccion: `Estamos preparando tu pedido ${row.codigo} en Tostal.`,
      listo: `¡Tu pedido ${row.codigo} está listo! ${
        row.modo_entrega === "retiro"
          ? "Puedes pasar a retirarlo."
          : "Pronto sale a envío."
      }`,
      entregado: `Gracias por pedir en Tostal. Tu pedido ${row.codigo} fue entregado.`,
      cancelado: `Tu pedido ${row.codigo} en Tostal fue cancelado. Escríbenos si tienes dudas.`,
    };
    if (textos[estado]) {
      await sqlRun(
        `INSERT INTO avisos_whatsapp (id, pedido_id, destinatario, telefono, evento, texto, estado, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
        id(),
        pedidoId,
        row.cliente_nombre,
        row.cliente_telefono,
        estado,
        textos[estado],
        now
      );
    }
  });

  const pedido = (await getPedido(pedidoId))!;
  publishPedidoEvent("estado_cambiado", pedido);
  return { ok: true, pedido };
}

export async function marcarPago(
  pedidoId: string,
  estadoPago: PedidoPublico["estadoPago"]
) {
  await boot();
  await sqlRun(
    `UPDATE pedidos SET estado_pago = ?, actualizado_en = ? WHERE id = ?`,
    estadoPago,
    new Date().toISOString(),
    pedidoId
  );
  const pedido = await getPedido(pedidoId);
  if (pedido && estadoPago === "pagado") {
    publishPedidoEvent("pago_confirmado", pedido);
  }
  return pedido;
}
