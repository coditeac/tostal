import { getDb } from "./db";
import { ensureSeed } from "./seed";
import { listInsumos, getReceta } from "./catalogo";
import { id, hoyISO, sumarDias } from "./utils";

function boot() {
  ensureSeed();
}

export type ItemSugerido = {
  insumoId: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  cantidadSugerida: number;
  proveedor: string | null;
  motivo: "bajo_minimo" | "demanda" | "ambos";
  costoUnitario: number;
};

export type ListaCompra = {
  id: string;
  estado: string;
  creadoEn: string;
  notas: string | null;
  items: Array<{
    id: string;
    insumoId: string;
    nombre: string;
    unidad: string;
    cantidadSugerida: number;
    cantidad: number;
    proveedor: string | null;
    motivo: string | null;
  }>;
};

export type CarritoCompra = {
  id: string;
  proveedor: string | null;
  estado: string;
  creadoEn: string;
  compradoEn: string | null;
  notas: string | null;
  total: number;
  lineas: Array<{
    id: string;
    insumoId: string;
    nombre: string;
    unidad: string;
    cantidad: number;
    costoUnitario: number;
    comprada: boolean;
  }>;
};

/** Explosión de demanda (pedidos próximos) + ítems bajo mínimo */
export function calcularSugerencia(diasAdelante = 7): ItemSugerido[] {
  boot();
  const db = getDb();
  const desde = hoyISO();
  const hasta = sumarDias(desde, diasAdelante);

  const demanda: Record<string, number> = {};
  const lineas = db
    .prepare(
      `SELECT pl.producto_id as productoId, pl.cantidad
       FROM pedido_lineas pl
       JOIN pedidos p ON p.id = pl.pedido_id
       WHERE p.fecha_entrega >= ? AND p.fecha_entrega <= ?
         AND p.estado IN ('recibido','confirmado','en_produccion')
         AND p.insumos_descontados = 0`
    )
    .all(desde, hasta) as Array<{ productoId: string; cantidad: number }>;

  for (const l of lineas) {
    const receta = getReceta(l.productoId);
    for (const r of receta) {
      demanda[r.insumoId] = (demanda[r.insumoId] || 0) + r.cantidad * l.cantidad;
    }
  }

  const out: ItemSugerido[] = [];
  for (const i of listInsumos()) {
    const reqDemanda = demanda[i.id] || 0;
    const stockTrasDemanda = i.stockActual - reqDemanda;
    const porMinimo = Math.max(0, i.stockMinimo - Math.min(i.stockActual, stockTrasDemanda));
    const porDemanda = Math.max(0, reqDemanda - i.stockActual);
    const cantidad = Math.max(porMinimo, porDemanda, i.stockMinimo - i.stockActual);
    if (cantidad <= 0 && i.stockActual > i.stockMinimo) continue;
    if (cantidad <= 0) continue;

    let motivo: ItemSugerido["motivo"] = "bajo_minimo";
    if (porDemanda > 0 && i.stockActual <= i.stockMinimo) motivo = "ambos";
    else if (porDemanda > 0) motivo = "demanda";

    out.push({
      insumoId: i.id,
      nombre: i.nombre,
      unidad: i.unidad,
      stockActual: i.stockActual,
      stockMinimo: i.stockMinimo,
      cantidadSugerida: Math.ceil(cantidad * 100) / 100,
      proveedor: i.proveedorPreferido,
      motivo,
      costoUnitario: i.costoUnitario,
    });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function crearListaDesdeSugerencia(
  items?: Array<{ insumoId: string; cantidad: number; proveedor?: string | null }>,
  notas?: string | null
): ListaCompra {
  boot();
  const sugeridos = calcularSugerencia();
  const byId = Object.fromEntries(sugeridos.map((s) => [s.insumoId, s]));
  const selected =
    items && items.length
      ? items
      : sugeridos.map((s) => ({
          insumoId: s.insumoId,
          cantidad: s.cantidadSugerida,
          proveedor: s.proveedor,
        }));

  const now = new Date().toISOString();
  const listaId = id();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO listas_compra (id, estado, creado_en, notas) VALUES (?, 'lista', ?, ?)`
    ).run(listaId, now, notas || null);
    const stmt = db.prepare(
      `INSERT INTO lista_compra_items
       (id, lista_id, insumo_id, cantidad_sugerida, cantidad, proveedor, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const it of selected) {
      const sug = byId[it.insumoId];
      stmt.run(
        id(),
        listaId,
        it.insumoId,
        sug?.cantidadSugerida ?? it.cantidad,
        it.cantidad,
        it.proveedor ?? sug?.proveedor ?? null,
        sug?.motivo ?? "manual"
      );
    }
  });
  tx();
  return getLista(listaId)!;
}

export function getLista(listaId: string): ListaCompra | null {
  boot();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, estado, creado_en as creadoEn, notas FROM listas_compra WHERE id = ?`
    )
    .get(listaId) as
    | { id: string; estado: string; creadoEn: string; notas: string | null }
    | undefined;
  if (!row) return null;
  const items = db
    .prepare(
      `SELECT li.id, li.insumo_id as insumoId, i.nombre, i.unidad,
              li.cantidad_sugerida as cantidadSugerida, li.cantidad,
              li.proveedor, li.motivo
       FROM lista_compra_items li
       JOIN insumos i ON i.id = li.insumo_id
       WHERE li.lista_id = ?
       ORDER BY i.nombre`
    )
    .all(listaId) as ListaCompra["items"];
  return { ...row, items };
}

export function listListas(limit = 20): Array<Omit<ListaCompra, "items"> & { itemCount: number }> {
  boot();
  return getDb()
    .prepare(
      `SELECT l.id, l.estado, l.creado_en as creadoEn, l.notas,
              (SELECT COUNT(*) FROM lista_compra_items WHERE lista_id = l.id) as itemCount
       FROM listas_compra l
       ORDER BY l.creado_en DESC
       LIMIT ?`
    )
    .all(limit) as Array<Omit<ListaCompra, "items"> & { itemCount: number }>;
}

export function actualizarItemLista(
  itemId: string,
  cantidad: number,
  proveedor?: string | null
) {
  boot();
  getDb()
    .prepare(
      `UPDATE lista_compra_items SET cantidad = ?, proveedor = COALESCE(?, proveedor) WHERE id = ?`
    )
    .run(cantidad, proveedor ?? null, itemId);
}

export function crearCarritoDesdeLista(
  listaId: string,
  proveedor?: string | null
): CarritoCompra {
  boot();
  const lista = getLista(listaId);
  if (!lista) throw new Error("Lista no encontrada");
  const now = new Date().toISOString();
  const carritoId = id();
  const db = getDb();
  const insumos = Object.fromEntries(listInsumos().map((i) => [i.id, i]));

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO carritos_compra (id, proveedor, estado, creado_en, comprado_en, notas, total, lista_id)
       VALUES (?, ?, 'lista', ?, NULL, NULL, 0, ?)`
    ).run(carritoId, proveedor || lista.items[0]?.proveedor || null, now, listaId);

    const stmt = db.prepare(
      `INSERT INTO carrito_compra_lineas
       (id, carrito_id, insumo_id, cantidad, costo_unitario, comprada)
       VALUES (?, ?, ?, ?, ?, 0)`
    );
    let total = 0;
    for (const it of lista.items) {
      const costo = insumos[it.insumoId]?.costoUnitario ?? 0;
      total += Math.round(it.cantidad * costo);
      stmt.run(id(), carritoId, it.insumoId, it.cantidad, costo);
    }
    db.prepare(`UPDATE carritos_compra SET total = ? WHERE id = ?`).run(
      total,
      carritoId
    );
    db.prepare(`UPDATE listas_compra SET estado = 'convertida' WHERE id = ?`).run(
      listaId
    );
  });
  tx();
  return getCarrito(carritoId)!;
}

export function crearCarritoManual(
  lineas: Array<{ insumoId: string; cantidad: number; costoUnitario?: number }>,
  proveedor?: string | null
): CarritoCompra {
  boot();
  const now = new Date().toISOString();
  const carritoId = id();
  const db = getDb();
  const insumos = Object.fromEntries(listInsumos().map((i) => [i.id, i]));
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO carritos_compra (id, proveedor, estado, creado_en, comprado_en, notas, total, lista_id)
       VALUES (?, ?, 'borrador', ?, NULL, NULL, 0, NULL)`
    ).run(carritoId, proveedor || null, now);
    const stmt = db.prepare(
      `INSERT INTO carrito_compra_lineas
       (id, carrito_id, insumo_id, cantidad, costo_unitario, comprada)
       VALUES (?, ?, ?, ?, ?, 0)`
    );
    let total = 0;
    for (const l of lineas) {
      const costo = l.costoUnitario ?? insumos[l.insumoId]?.costoUnitario ?? 0;
      total += Math.round(l.cantidad * costo);
      stmt.run(id(), carritoId, l.insumoId, l.cantidad, costo);
    }
    db.prepare(`UPDATE carritos_compra SET total = ?, estado = 'lista' WHERE id = ?`).run(
      total,
      carritoId
    );
  });
  tx();
  return getCarrito(carritoId)!;
}

export function getCarrito(carritoId: string): CarritoCompra | null {
  boot();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, proveedor, estado, creado_en as creadoEn, comprado_en as compradoEn,
              notas, total FROM carritos_compra WHERE id = ?`
    )
    .get(carritoId) as
    | Omit<CarritoCompra, "lineas">
    | undefined;
  if (!row) return null;
  const lineas = db
    .prepare(
      `SELECT cl.id, cl.insumo_id as insumoId, i.nombre, i.unidad, cl.cantidad,
              cl.costo_unitario as costoUnitario, cl.comprada as compradaRaw
       FROM carrito_compra_lineas cl
       JOIN insumos i ON i.id = cl.insumo_id
       WHERE cl.carrito_id = ?
       ORDER BY i.nombre`
    )
    .all(carritoId) as Array<{
    id: string;
    insumoId: string;
    nombre: string;
    unidad: string;
    cantidad: number;
    costoUnitario: number;
    compradaRaw: number;
  }>;
  return {
    ...row,
    lineas: lineas.map((l) => ({
      id: l.id,
      insumoId: l.insumoId,
      nombre: l.nombre,
      unidad: l.unidad,
      cantidad: l.cantidad,
      costoUnitario: l.costoUnitario,
      comprada: !!l.compradaRaw,
    })),
  };
}

export function listCarritos(limit = 20) {
  boot();
  return getDb()
    .prepare(
      `SELECT id, proveedor, estado, creado_en as creadoEn, comprado_en as compradoEn,
              notas, total FROM carritos_compra
       ORDER BY creado_en DESC LIMIT ?`
    )
    .all(limit);
}

/** Marca carrito comprado: actualiza precios, entra stock y registra gasto */
export function marcarCarritoComprado(
  carritoId: string,
  opts?: {
    lineasCompradas?: string[]; // ids de línea; si omitido, todas
    registrarGasto?: boolean;
    usuarioId?: string | null;
  }
): { ok: true; carrito: CarritoCompra } | { ok: false; error: string } {
  boot();
  const carrito = getCarrito(carritoId);
  if (!carrito) return { ok: false, error: "Carrito no encontrado." };
  if (carrito.estado === "comprada") {
    return { ok: false, error: "Este carrito ya está marcado como comprado." };
  }

  const now = new Date().toISOString();
  const db = getDb();
  const idsSet = opts?.lineasCompradas
    ? new Set(opts.lineasCompradas)
    : null;

  const tx = db.transaction(() => {
    let totalComprado = 0;
    for (const l of carrito.lineas) {
      if (idsSet && !idsSet.has(l.id)) continue;
      if (l.comprada) continue;
      db.prepare(
        `UPDATE insumos SET stock_actual = stock_actual + ?, costo_unitario = ? WHERE id = ?`
      ).run(l.cantidad, l.costoUnitario, l.insumoId);
      db.prepare(
        `INSERT INTO movimientos_inventario
         (id, insumo_id, tipo, cantidad, costo_unitario, motivo, pedido_id, usuario_id, creado_en)
         VALUES (?, ?, 'entrada', ?, ?, ?, NULL, ?, ?)`
      ).run(
        id(),
        l.insumoId,
        l.cantidad,
        l.costoUnitario,
        `Compra proveedor${carrito.proveedor ? `: ${carrito.proveedor}` : ""}`,
        opts?.usuarioId || null,
        now
      );
      db.prepare(
        `UPDATE carrito_compra_lineas SET comprada = 1 WHERE id = ?`
      ).run(l.id);
      totalComprado += Math.round(l.cantidad * l.costoUnitario);
    }

    const pendientes = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM carrito_compra_lineas WHERE carrito_id = ? AND comprada = 0`
        )
        .get(carritoId) as { c: number }
    ).c;

    db.prepare(
      `UPDATE carritos_compra SET estado = ?, comprado_en = ?, total = ? WHERE id = ?`
    ).run(
      pendientes > 0 ? "parcial" : "comprada",
      now,
      totalComprado || carrito.total,
      carritoId
    );

    if (opts?.registrarGasto !== false && totalComprado > 0) {
      db.prepare(
        `INSERT INTO gastos (id, categoria, monto, fecha, metodo_pago, notas, creado_en, comprobante, compra_id)
         VALUES (?, 'insumos', ?, ?, ?, ?, ?, NULL, ?)`
      ).run(
        id(),
        totalComprado,
        hoyISO(),
        "efectivo",
        `Compra a ${carrito.proveedor || "proveedor"}`,
        now,
        carritoId
      );
    }
  });
  tx();
  return { ok: true, carrito: getCarrito(carritoId)! };
}

export function actualizarLineaCarrito(
  lineaId: string,
  data: { cantidad?: number; costoUnitario?: number }
) {
  boot();
  const db = getDb();
  const row = db
    .prepare(`SELECT carrito_id as carritoId FROM carrito_compra_lineas WHERE id = ?`)
    .get(lineaId) as { carritoId: string } | undefined;
  if (!row) return null;
  if (data.cantidad != null) {
    db.prepare(`UPDATE carrito_compra_lineas SET cantidad = ? WHERE id = ?`).run(
      data.cantidad,
      lineaId
    );
  }
  if (data.costoUnitario != null) {
    db.prepare(
      `UPDATE carrito_compra_lineas SET costo_unitario = ? WHERE id = ?`
    ).run(data.costoUnitario, lineaId);
  }
  const total = (
    db
      .prepare(
        `SELECT COALESCE(SUM(ROUND(cantidad * costo_unitario)), 0) as t
         FROM carrito_compra_lineas WHERE carrito_id = ?`
      )
      .get(row.carritoId) as { t: number }
  ).t;
  db.prepare(`UPDATE carritos_compra SET total = ? WHERE id = ?`).run(
    total,
    row.carritoId
  );
  return getCarrito(row.carritoId);
}
