import { getDb } from "./db";
import { ensureSeed } from "./seed";
import { getConfigPublica } from "./config";
import { getDia, getDisponibilidad, getProducto, listZonas } from "./catalogo";
import { id } from "./utils";
import type {
  EstadoPedido,
  LineaPedidoInput,
  MetodoPago,
  ModoEntrega,
  PedidoPublico,
} from "../../../../shared/types";

function boot() {
  ensureSeed();
}

function codigoPedido(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `T-${mm}${dd}-${n}`;
}

export function mapPedido(row: Record<string, unknown>): PedidoPublico {
  const db = getDb();
  const lineas = db
    .prepare(
      `SELECT id, producto_id as productoId, producto_nombre as productoNombre,
              cantidad, precio_unitario as precioUnitario, subtotal, notas
       FROM pedido_lineas WHERE pedido_id = ?`
    )
    .all(row.id as string) as PedidoPublico["lineas"];

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

export function getPedido(pedidoId: string): PedidoPublico | null {
  boot();
  const row = getDb()
    .prepare(`SELECT * FROM pedidos WHERE id = ? OR codigo = ?`)
    .get(pedidoId, pedidoId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapPedido(row);
}

export function listPedidos(opts?: {
  fecha?: string;
  canal?: string;
}): PedidoPublico[] {
  boot();
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
  const rows = getDb().prepare(sql).all(...params) as Array<
    Record<string, unknown>
  >;
  return rows.map(mapPedido);
}

export function crearPedidoRemoto(input: {
  fechaEntrega: string;
  modoEntrega: ModoEntrega;
  zonaId?: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  direccion?: string | null;
  metodoPago: MetodoPago;
  notas?: string | null;
  lineas: LineaPedidoInput[];
}): { ok: true; pedido: PedidoPublico } | { ok: false; error: string } {
  boot();
  const config = getConfigPublica();
  if (!config.canalRemotoActivo) {
    return { ok: false, error: "El canal remoto está desactivado." };
  }
  const dia = getDia(input.fechaEntrega);
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
    getDisponibilidad(input.fechaEntrega).map((d) => [d.productoId, d.disponible])
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
    const prod = getProducto(l.productoId);
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
    const zona = listZonas().find((z) => z.id === input.zonaId && z.activa);
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
    const count = (
      getDb()
        .prepare(
          `SELECT COUNT(*) as c FROM pedidos
           WHERE fecha_entrega = ? AND estado != 'cancelado'`
        )
        .get(input.fechaEntrega) as { c: number }
    ).c;
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
  const db = getDb();

  const tx = db.transaction(() => {
    let clienteId: string | null = null;
    const existente = db
      .prepare(`SELECT id FROM clientes WHERE telefono = ?`)
      .get(input.clienteTelefono.trim()) as { id: string } | undefined;
    if (existente) {
      clienteId = existente.id;
      db.prepare(`UPDATE clientes SET nombre = ? WHERE id = ?`).run(
        input.clienteNombre.trim(),
        clienteId
      );
    } else {
      clienteId = id();
      db.prepare(
        `INSERT INTO clientes (id, nombre, telefono, email, notas, creado_en)
         VALUES (?, ?, ?, NULL, NULL, ?)`
      ).run(
        clienteId,
        input.clienteNombre.trim(),
        input.clienteTelefono.trim(),
        now
      );
    }

    db.prepare(
      `INSERT INTO pedidos (
        id, codigo, canal, estado, estado_pago, metodo_pago, modo_entrega,
        fecha_entrega, zona_id, cliente_id, cliente_nombre, cliente_telefono,
        direccion, subtotal, costo_envio, total, notas, insumos_descontados,
        ficha_codigo, creado_en, actualizado_en
      ) VALUES (?, ?, 'remoto', 'recibido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`
    ).run(
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

    const lStmt = db.prepare(
      `INSERT INTO pedido_lineas (id, pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const l of lineasResueltas) {
      lStmt.run(
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
    db.prepare(
      `INSERT INTO avisos_whatsapp (id, pedido_id, destinatario, telefono, evento, texto, estado, creado_en)
       VALUES (?, ?, ?, ?, 'recibido', ?, 'pendiente', ?)`
    ).run(
      id(),
      pedidoId,
      input.clienteNombre.trim(),
      input.clienteTelefono.trim(),
      texto,
      now
    );
  });

  tx();
  return { ok: true, pedido: getPedido(pedidoId)! };
}

export function actualizarEstadoPedido(
  pedidoId: string,
  estado: EstadoPedido,
  usuarioId?: string
): { ok: true; pedido: PedidoPublico } | { ok: false; error: string } {
  boot();
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM pedidos WHERE id = ?`)
    .get(pedidoId) as Record<string, unknown> | undefined;
  if (!row) return { ok: false, error: "Pedido no encontrado." };

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    // Descuento de insumos al iniciar producción
    if (estado === "en_produccion" && !row.insumos_descontados) {
      const lineas = db
        .prepare(
          `SELECT producto_id as productoId, cantidad FROM pedido_lineas WHERE pedido_id = ?`
        )
        .all(pedidoId) as Array<{ productoId: string; cantidad: number }>;

      for (const linea of lineas) {
        const receta = db
          .prepare(
            `SELECT insumo_id as insumoId, cantidad FROM receta_lineas WHERE producto_id = ?`
          )
          .all(linea.productoId) as Array<{
          insumoId: string;
          cantidad: number;
        }>;
        for (const r of receta) {
          const qty = r.cantidad * linea.cantidad;
          db.prepare(
            `UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?`
          ).run(qty, r.insumoId);
          db.prepare(
            `INSERT INTO movimientos_inventario
             (id, insumo_id, tipo, cantidad, costo_unitario, motivo, pedido_id, usuario_id, creado_en)
             VALUES (?, ?, 'produccion', ?, NULL, 'Inicio de producción', ?, ?, ?)`
          ).run(id(), r.insumoId, qty, pedidoId, usuarioId || null, now);
        }
      }
      db.prepare(
        `UPDATE pedidos SET insumos_descontados = 1 WHERE id = ?`
      ).run(pedidoId);
    }

    db.prepare(
      `UPDATE pedidos SET estado = ?, actualizado_en = ? WHERE id = ?`
    ).run(estado, now, pedidoId);

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
      db.prepare(
        `INSERT INTO avisos_whatsapp (id, pedido_id, destinatario, telefono, evento, texto, estado, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`
      ).run(
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

  tx();
  return { ok: true, pedido: getPedido(pedidoId)! };
}

export function marcarPago(
  pedidoId: string,
  estadoPago: PedidoPublico["estadoPago"]
) {
  boot();
  getDb()
    .prepare(
      `UPDATE pedidos SET estado_pago = ?, actualizado_en = ? WHERE id = ?`
    )
    .run(estadoPago, new Date().toISOString(), pedidoId);
  return getPedido(pedidoId);
}
