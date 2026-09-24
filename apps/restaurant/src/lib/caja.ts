import { sqlAll, sqlGet, sqlRun, sqlTransaction } from "./db";
import { ensureSeed } from "./seed";
import { getConfigPublica } from "./config";
import { getProducto, listProductos } from "./catalogo";
import { id, hoyISO } from "./utils";
import type { MetodoPago, PedidoPublico } from "../../../../shared/types";
import { mapPedido, getPedido, actualizarEstadoPedido } from "./pedidos";

async function boot() {
  await ensureSeed();
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

export async function getTurnoAbierto(): Promise<TurnoCaja | null> {
  await boot();
  const row = await sqlGet<Record<string, unknown>>(
    `SELECT * FROM turnos_caja WHERE cerrado_en IS NULL ORDER BY abierto_en DESC LIMIT 1`
  );
  return row ? mapTurno(row) : null;
}

export async function abrirTurno(
  usuarioId?: string | null
): Promise<TurnoCaja> {
  await boot();
  const existing = await getTurnoAbierto();
  if (existing) return existing;
  const tid = id();
  const now = new Date().toISOString();
  await sqlRun(
    `INSERT INTO turnos_caja (id, abierto_en, cerrado_en, usuario_id, total_efectivo, total_otros, notas, contador_fichas)
     VALUES (?, ?, NULL, ?, 0, 0, NULL, 0)`,
    tid,
    now,
    usuarioId || null
  );
  return (await getTurnoAbierto())!;
}

export async function cerrarTurno(
  notas?: string | null
): Promise<TurnoCaja | null> {
  await boot();
  const turno = await getTurnoAbierto();
  if (!turno) return null;
  const now = new Date().toISOString();

  // Recalcular totales del turno desde pedidos
  const rows = await sqlAll<{ metodo: string; t: number }>(
    `SELECT metodo_pago as metodo, SUM(total) as t FROM pedidos
     WHERE turno_id = ? AND estado != 'cancelado' AND estado_pago = 'pagado'
     GROUP BY metodo_pago`,
    turno.id
  );

  let efectivo = 0;
  let otros = 0;
  for (const r of rows) {
    if (r.metodo === "efectivo_mostrador") efectivo += r.t;
    else otros += r.t;
  }

  await sqlRun(
    `UPDATE turnos_caja SET cerrado_en = ?, total_efectivo = ?, total_otros = ?, notas = ? WHERE id = ?`,
    now,
    efectivo,
    otros,
    notas || null,
    turno.id
  );

  const closed = await sqlGet<Record<string, unknown>>(
    `SELECT * FROM turnos_caja WHERE id = ?`,
    turno.id
  );
  return mapTurno(closed!);
}

async function siguienteFicha(turnoId: string): Promise<string> {
  await sqlRun(
    `UPDATE turnos_caja SET contador_fichas = contador_fichas + 1 WHERE id = ?`,
    turnoId
  );
  const row = await sqlGet<{ n: number }>(
    `SELECT contador_fichas as n FROM turnos_caja WHERE id = ?`,
    turnoId
  );
  return `F-${String(row!.n).padStart(3, "0")}`;
}

export async function crearPedidoMostrador(input: {
  clienteNombre?: string;
  clienteTelefono?: string;
  metodoPago: MetodoPago;
  lineas: Array<{
    productoId: string;
    cantidad: number;
    desdeVitrina?: boolean;
  }>;
  notas?: string | null;
  usuarioId?: string | null;
}): Promise<
  | { ok: true; pedido: PedidoPublico & { fichaCodigo: string } }
  | { ok: false; error: string }
> {
  await boot();
  const config = await getConfigPublica();
  if (!config.canalMostradorActivo) {
    return {
      ok: false,
      error: "El canal mostrador está apagado. Actívalo en Configuración.",
    };
  }
  if (!input.lineas.length) {
    return { ok: false, error: "Agrega al menos un producto." };
  }

  let turno = await getTurnoAbierto();
  if (!turno) {
    turno = await abrirTurno(input.usuarioId);
  }

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
    const prod = await getProducto(l.productoId);
    if (!prod || !prod.activoCatalogo) {
      return { ok: false, error: "Producto no disponible." };
    }
    if (l.desdeVitrina) {
      const stockRow = await sqlGet<{ cantidad: number }>(
        `SELECT cantidad FROM vitrina_stock WHERE producto_id = ?`,
        l.productoId
      );
      const stock = stockRow?.cantidad ?? 0;
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
  const ficha = await siguienteFicha(turno.id);
  const nombre = (input.clienteNombre || "Cliente mostrador").trim();
  const telefono = (input.clienteTelefono || "0000000000").trim();
  const metodo = input.metodoPago || "efectivo_mostrador";
  const necesitaPrep = lineasResueltas.some((l) => !l.desdeVitrina);
  const turnoId = turno.id;

  await sqlTransaction(async () => {
    await sqlRun(
      `INSERT INTO pedidos (
        id, codigo, canal, estado, estado_pago, metodo_pago, modo_entrega,
        fecha_entrega, zona_id, cliente_id, cliente_nombre, cliente_telefono,
        direccion, subtotal, costo_envio, total, notas, insumos_descontados,
        ficha_codigo, creado_en, actualizado_en, turno_id
      ) VALUES (?, ?, 'mostrador', ?, 'pagado', ?, 'retiro', ?, NULL, NULL, ?, ?, NULL, ?, 0, ?, ?, 0, ?, ?, ?, ?)`,
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
      turnoId
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
        l.desdeVitrina ? "vitrina" : null
      );
      if (l.desdeVitrina) {
        await sqlRun(
          `UPDATE vitrina_stock SET cantidad = cantidad - ? WHERE producto_id = ?`,
          l.cantidad,
          l.productoId
        );
        await sqlRun(
          `INSERT INTO vitrina_movimientos (id, producto_id, tipo, cantidad, pedido_id, motivo, creado_en)
           VALUES (?, ?, 'venta', ?, ?, 'Venta mostrador', ?)`,
          id(),
          l.productoId,
          l.cantidad,
          pedidoId,
          now
        );
      }
    }

    if (metodo === "efectivo_mostrador") {
      await sqlRun(
        `UPDATE turnos_caja SET total_efectivo = total_efectivo + ? WHERE id = ?`,
        subtotal,
        turnoId
      );
    } else {
      await sqlRun(
        `UPDATE turnos_caja SET total_otros = total_otros + ? WHERE id = ?`,
        subtotal,
        turnoId
      );
    }
  });

  const pedido = (await getPedido(pedidoId))!;
  return {
    ok: true,
    pedido: { ...pedido, fichaCodigo: ficha },
  };
}

export async function entregarPorFicha(
  fichaCodigo: string
): Promise<{ ok: true; pedido: PedidoPublico } | { ok: false; error: string }> {
  await boot();
  const row = await sqlGet<{ id: string; estado: string }>(
    `SELECT id, estado FROM pedidos WHERE ficha_codigo = ?`,
    fichaCodigo.trim()
  );
  if (!row) return { ok: false, error: "No hay pedido con esa ficha." };
  if (row.estado === "entregado") {
    return { ok: false, error: "Esa ficha ya fue entregada." };
  }
  if (
    row.estado !== "listo" &&
    row.estado !== "confirmado" &&
    row.estado !== "en_produccion"
  ) {
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

export async function listPedidosMostradorActivos(): Promise<
  Array<PedidoPublico & { fichaCodigo: string | null }>
> {
  await boot();
  const rows = await sqlAll<Record<string, unknown>>(
    `SELECT * FROM pedidos
     WHERE canal = 'mostrador'
       AND estado NOT IN ('entregado','cancelado')
       AND fecha_entrega = ?
     ORDER BY creado_en ASC`,
    hoyISO()
  );
  return Promise.all(
    rows.map(async (r) => ({
      ...(await mapPedido(r)),
      fichaCodigo: (r.ficha_codigo as string) || null,
    }))
  );
}

export async function listVitrina(): Promise<VitrinaItem[]> {
  await boot();
  const productos = (await listProductos()).filter((p) => p.activoCatalogo);
  const stockRows = await sqlAll<{ id: string; cantidad: number }>(
    `SELECT producto_id as id, cantidad FROM vitrina_stock`
  );
  const stocks = Object.fromEntries(stockRows.map((r) => [r.id, r.cantidad]));
  return productos.map((p) => ({
    productoId: p.id,
    nombre: p.nombre,
    precio: p.precio,
    cantidad: stocks[p.id] || 0,
  }));
}

export async function ajustarVitrina(input: {
  productoId: string;
  cantidad: number;
  tipo: "entrada" | "salida" | "merma" | "set";
  motivo?: string | null;
  pedidoId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await boot();
  if (input.cantidad < 0) return { ok: false, error: "Cantidad inválida." };
  const prod = await getProducto(input.productoId);
  if (!prod) return { ok: false, error: "Producto no encontrado." };

  const actualRow = await sqlGet<{ cantidad: number }>(
    `SELECT cantidad FROM vitrina_stock WHERE producto_id = ?`,
    input.productoId
  );
  const actual = actualRow?.cantidad ?? 0;

  let nuevo = actual;
  if (input.tipo === "entrada") nuevo = actual + input.cantidad;
  else if (input.tipo === "set") nuevo = input.cantidad;
  else nuevo = actual - input.cantidad;

  if (nuevo < 0)
    return { ok: false, error: "No hay suficientes unidades en vitrina." };

  const now = new Date().toISOString();
  await sqlTransaction(async () => {
    await sqlRun(
      `INSERT INTO vitrina_stock (producto_id, cantidad) VALUES (?, ?)
       ON CONFLICT(producto_id) DO UPDATE SET cantidad = excluded.cantidad`,
      input.productoId,
      nuevo
    );
    await sqlRun(
      `INSERT INTO vitrina_movimientos (id, producto_id, tipo, cantidad, pedido_id, motivo, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id(),
      input.productoId,
      input.tipo === "set" ? "entrada" : input.tipo,
      input.cantidad,
      input.pedidoId || null,
      input.motivo || null,
      now
    );
  });
  return { ok: true };
}

/** Al marcar pedido listo desde producción, opcionalmente enviar a vitrina */
export async function enviarAVitrinaDesdePedido(
  pedidoId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await boot();
  const lineas = await sqlAll<{
    productoId: string;
    cantidad: number;
    notas: string | null;
  }>(
    `SELECT producto_id as productoId, cantidad, notas FROM pedido_lineas WHERE pedido_id = ?`,
    pedidoId
  );
  for (const l of lineas) {
    if (l.notas === "vitrina") continue; // ya salió de vitrina
    const res = await ajustarVitrina({
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
