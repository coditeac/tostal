import { getDb } from "./db";
import { ensureSeed } from "./seed";
import { getConfigPublica } from "./config";
import { getProducto, listProductos } from "./catalogo";
import { id, hoyISO } from "./utils";
import type {
  MetodoPago,
  PedidoPublico,
} from "../../../../shared/types";
import { mapPedido, getPedido, actualizarEstadoPedido } from "./pedidos";

function boot() {
  ensureSeed();
}

export type TurnoCaja = {
  id: string;
  abiertoEn: string;
  cerradoEn: string | null;
  usuarioId: string | null;
  totalEfectivo: number;
  totalOtros: number;
  notas: string | null;
  contadorFichas: number;
};

export type VitrinaItem = {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

function mapTurno(row: Record<string, unknown>): TurnoCaja {
  return {
    id: row.id as string,
    abiertoEn: row.abierto_en as string,
    cerradoEn: (row.cerrado_en as string) || null,
    usuarioId: (row.usuario_id as string) || null,
    totalEfectivo: (row.total_efectivo as number) || 0,
    totalOtros: (row.total_otros as number) || 0,
    notas: (row.notas as string) || null,
    contadorFichas: (row.contador_fichas as number) || 0,
  };
}

export function getTurnoAbierto(): TurnoCaja | null {
  boot();
  const row = getDb()
    .prepare(`SELECT * FROM turnos_caja WHERE cerrado_en IS NULL ORDER BY abierto_en DESC LIMIT 1`)
    .get() as Record<string, unknown> | undefined;
  return row ? mapTurno(row) : null;
}

export function abrirTurno(usuarioId?: string | null): TurnoCaja {
  boot();
  const existing = getTurnoAbierto();
  if (existing) return existing;
  const tid = id();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO turnos_caja (id, abierto_en, cerrado_en, usuario_id, total_efectivo, total_otros, notas, contador_fichas)
       VALUES (?, ?, NULL, ?, 0, 0, NULL, 0)`
    )
    .run(tid, now, usuarioId || null);
  return getTurnoAbierto()!;
}

export function cerrarTurno(notas?: string | null): TurnoCaja | null {
  boot();
  const turno = getTurnoAbierto();
  if (!turno) return null;
  const now = new Date().toISOString();

  // Recalcular totales del turno desde pedidos
  const rows = getDb()
    .prepare(
      `SELECT metodo_pago as metodo, SUM(total) as t FROM pedidos
       WHERE turno_id = ? AND estado != 'cancelado' AND estado_pago = 'pagado'
       GROUP BY metodo_pago`
    )
    .all(turno.id) as Array<{ metodo: string; t: number }>;

  let efectivo = 0;
  let otros = 0;
  for (const r of rows) {
    if (r.metodo === "efectivo_mostrador") efectivo += r.t;
    else otros += r.t;
  }

  getDb()
    .prepare(
      `UPDATE turnos_caja SET cerrado_en = ?, total_efectivo = ?, total_otros = ?, notas = ? WHERE id = ?`
    )
    .run(now, efectivo, otros, notas || null, turno.id);

  return mapTurno(
    getDb().prepare(`SELECT * FROM turnos_caja WHERE id = ?`).get(turno.id) as Record<
      string,
      unknown
    >
  );
}

function siguienteFicha(turnoId: string): string {
  const db = getDb();
  db.prepare(
    `UPDATE turnos_caja SET contador_fichas = contador_fichas + 1 WHERE id = ?`
  ).run(turnoId);
  const n = (
    db
      .prepare(`SELECT contador_fichas as n FROM turnos_caja WHERE id = ?`)
      .get(turnoId) as { n: number }
  ).n;
  return `F-${String(n).padStart(3, "0")}`;
}

export function crearPedidoMostrador(input: {
  clienteNombre?: string;
  clienteTelefono?: string;
  metodoPago: MetodoPago;
  lineas: Array<{ productoId: string; cantidad: number; desdeVitrina?: boolean }>;
  notas?: string | null;
  usuarioId?: string | null;
}): { ok: true; pedido: PedidoPublico & { fichaCodigo: string } } | { ok: false; error: string } {
  boot();
  const config = getConfigPublica();
  if (!config.canalMostradorActivo) {
    return {
      ok: false,
      error: "El canal mostrador está apagado. Actívalo en Configuración.",
    };
  }
  if (!input.lineas.length) {
    return { ok: false, error: "Agrega al menos un producto." };
  }

  let turno = getTurnoAbierto();
  if (!turno) {
    turno = abrirTurno(input.usuarioId);
  }

  const db = getDb();
  let subtotal = 0;
  const lineasResueltas: Array<{
    productoId: string;
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    desdeVitrina: boolean;
  }> = [];

  for (const l of input.lineas) {
    if (l.cantidad < 1) return { ok: false, error: "Cantidad inválida." };
    const prod = getProducto(l.productoId);
    if (!prod || !prod.activoCatalogo) {
      return { ok: false, error: "Producto no disponible." };
    }
    if (l.desdeVitrina) {
      const stock = (
        db
          .prepare(`SELECT cantidad FROM vitrina_stock WHERE producto_id = ?`)
          .get(l.productoId) as { cantidad: number } | undefined
      )?.cantidad ?? 0;
      if (stock < l.cantidad) {
        return {
          ok: false,
          error: `No hay suficiente ${prod.nombre} en vitrina (${stock} u).`,
        };
      }
    }
    const sub = prod.precio * l.cantidad;
    subtotal += sub;
    lineasResueltas.push({
      productoId: prod.id,
      productoNombre: prod.nombre,
      cantidad: l.cantidad,
      precioUnitario: prod.precio,
      subtotal: sub,
      desdeVitrina: !!l.desdeVitrina,
    });
  }

  const now = new Date().toISOString();
  const pedidoId = id();
  const codigo = `M-${hoyISO().slice(5).replace("-", "")}-${Math.floor(
    100 + Math.random() * 900
  )}`;
  const ficha = siguienteFicha(turno.id);
  const nombre = (input.clienteNombre || "Cliente mostrador").trim();
  const telefono = (input.clienteTelefono || "0000000000").trim();
  const metodo = input.metodoPago || "efectivo_mostrador";
  const necesitaPrep = lineasResueltas.some((l) => !l.desdeVitrina);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO pedidos (
        id, codigo, canal, estado, estado_pago, metodo_pago, modo_entrega,
        fecha_entrega, zona_id, cliente_id, cliente_nombre, cliente_telefono,
        direccion, subtotal, costo_envio, total, notas, insumos_descontados,
        ficha_codigo, creado_en, actualizado_en, turno_id
      ) VALUES (?, ?, 'mostrador', ?, 'pagado', ?, 'retiro', ?, NULL, NULL, ?, ?, NULL, ?, 0, ?, ?, 0, ?, ?, ?, ?)`
    ).run(
      pedidoId,
      codigo,
      necesitaPrep ? "confirmado" : "listo",
      metodo,
      hoyISO(),
      nombre,
      telefono,
      subtotal,
      subtotal,
      input.notas || null,
      ficha,
      now,
      now,
      turno!.id
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
        l.desdeVitrina ? "vitrina" : null
      );
      if (l.desdeVitrina) {
        db.prepare(
          `UPDATE vitrina_stock SET cantidad = cantidad - ? WHERE producto_id = ?`
        ).run(l.cantidad, l.productoId);
        db.prepare(
          `INSERT INTO vitrina_movimientos (id, producto_id, tipo, cantidad, pedido_id, motivo, creado_en)
           VALUES (?, ?, 'venta', ?, ?, 'Venta mostrador', ?)`
        ).run(id(), l.productoId, l.cantidad, pedidoId, now);
      }
    }

    if (metodo === "efectivo_mostrador") {
      db.prepare(
        `UPDATE turnos_caja SET total_efectivo = total_efectivo + ? WHERE id = ?`
      ).run(subtotal, turno!.id);
    } else {
      db.prepare(
        `UPDATE turnos_caja SET total_otros = total_otros + ? WHERE id = ?`
      ).run(subtotal, turno!.id);
    }
  });
  tx();

  const pedido = getPedido(pedidoId)!;
  return {
    ok: true,
    pedido: { ...pedido, fichaCodigo: ficha },
  };
}

export function entregarPorFicha(
  fichaCodigo: string
): { ok: true; pedido: PedidoPublico } | { ok: false; error: string } {
  boot();
  const row = getDb()
    .prepare(`SELECT id, estado FROM pedidos WHERE ficha_codigo = ?`)
    .get(fichaCodigo.trim()) as { id: string; estado: string } | undefined;
  if (!row) return { ok: false, error: "No hay pedido con esa ficha." };
  if (row.estado === "entregado") {
    return { ok: false, error: "Esa ficha ya fue entregada." };
  }
  if (row.estado !== "listo" && row.estado !== "confirmado" && row.estado !== "en_produccion") {
    // permitir entregar desde listo preferentemente
  }
  // Si aún no está listo, marcarlo listo primero no — exigir listo
  if (row.estado !== "listo") {
    return {
      ok: false,
      error: `El pedido aún está en «${row.estado.replace("_", " ")}». Márcalo listo antes de entregar.`,
    };
  }
  return actualizarEstadoPedido(row.id, "entregado");
}

export function listPedidosMostradorActivos(): Array<
  PedidoPublico & { fichaCodigo: string | null }
> {
  boot();
  const rows = getDb()
    .prepare(
      `SELECT * FROM pedidos
       WHERE canal = 'mostrador'
         AND estado NOT IN ('entregado','cancelado')
         AND fecha_entrega = ?
       ORDER BY creado_en ASC`
    )
    .all(hoyISO()) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    ...mapPedido(r),
    fichaCodigo: (r.ficha_codigo as string) || null,
  }));
}

export function listVitrina(): VitrinaItem[] {
  boot();
  const productos = listProductos().filter((p) => p.activoCatalogo);
  const stocks = Object.fromEntries(
    (
      getDb()
        .prepare(`SELECT producto_id as id, cantidad FROM vitrina_stock`)
        .all() as Array<{ id: string; cantidad: number }>
    ).map((r) => [r.id, r.cantidad])
  );
  return productos.map((p) => ({
    productoId: p.id,
    nombre: p.nombre,
    precio: p.precio,
    cantidad: stocks[p.id] || 0,
  }));
}

export function ajustarVitrina(input: {
  productoId: string;
  cantidad: number;
  tipo: "entrada" | "salida" | "merma" | "set";
  motivo?: string | null;
  pedidoId?: string | null;
}): { ok: true } | { ok: false; error: string } {
  boot();
  if (input.cantidad < 0) return { ok: false, error: "Cantidad inválida." };
  const db = getDb();
  const prod = getProducto(input.productoId);
  if (!prod) return { ok: false, error: "Producto no encontrado." };

  const actual = (
    db
      .prepare(`SELECT cantidad FROM vitrina_stock WHERE producto_id = ?`)
      .get(input.productoId) as { cantidad: number } | undefined
  )?.cantidad ?? 0;

  let nuevo = actual;
  if (input.tipo === "entrada") nuevo = actual + input.cantidad;
  else if (input.tipo === "set") nuevo = input.cantidad;
  else nuevo = actual - input.cantidad;

  if (nuevo < 0) return { ok: false, error: "No hay suficientes unidades en vitrina." };

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO vitrina_stock (producto_id, cantidad) VALUES (?, ?)
       ON CONFLICT(producto_id) DO UPDATE SET cantidad = excluded.cantidad`
    ).run(input.productoId, nuevo);
    db.prepare(
      `INSERT INTO vitrina_movimientos (id, producto_id, tipo, cantidad, pedido_id, motivo, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id(),
      input.productoId,
      input.tipo === "set" ? "entrada" : input.tipo,
      input.cantidad,
      input.pedidoId || null,
      input.motivo || null,
      now
    );
  });
  tx();
  return { ok: true };
}

/** Al marcar pedido listo desde producción, opcionalmente enviar a vitrina */
export function enviarAVitrinaDesdePedido(
  pedidoId: string
): { ok: true } | { ok: false; error: string } {
  boot();
  const db = getDb();
  const lineas = db
    .prepare(
      `SELECT producto_id as productoId, cantidad, notas FROM pedido_lineas WHERE pedido_id = ?`
    )
    .all(pedidoId) as Array<{
    productoId: string;
    cantidad: number;
    notas: string | null;
  }>;
  for (const l of lineas) {
    if (l.notas === "vitrina") continue; // ya salió de vitrina
    const res = ajustarVitrina({
      productoId: l.productoId,
      cantidad: l.cantidad,
      tipo: "entrada",
      motivo: "Producción terminada",
      pedidoId,
    });
    if (!res.ok) return res;
  }
  return { ok: true };
}
