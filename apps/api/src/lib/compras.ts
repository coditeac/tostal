import { sqlAll, sqlGet, sqlRun, sqlTransaction } from "./db";
import { ensureSeed } from "./seed";
import { listInsumos, getReceta, upsertInsumo } from "./catalogo";
import { id } from "./id";
import { hoyISO, sumarDias } from "./utils";

async function boot() {
  await ensureSeed();
}

export type Tienda = {
  id: string;
  nombre: string;
  notas: string | null;
  preferido: boolean;
};

export type ItemSugerido = {
  insumoId: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  cantidadSugerida: number;
  proveedor: string | null;
  motivo: "bajo_minimo" | "demanda" | "reserva" | "ambos";
  costoUnitario: number;
  paraTienda: boolean;
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
  tienda: string | null;
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

function normalizeTienda(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const t = nombre.trim();
  return t || null;
}

function tiendaMatch(
  preferido: string | null | undefined,
  tienda: string | null | undefined
): boolean {
  if (!tienda) return true;
  if (!preferido) return false;
  return preferido.trim().toLowerCase() === tienda.trim().toLowerCase();
}

export async function listTiendas(): Promise<Tienda[]> {
  await boot();
  const rows = await sqlAll<{
    id: string;
    nombre: string;
    notas: string | null;
    preferidoRaw: number;
  }>(
    `SELECT id, nombre, notas, preferido as preferidoRaw
     FROM proveedores ORDER BY preferido DESC, nombre`
  );
  const fromTable = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    notas: r.notas,
    preferido: !!r.preferidoRaw,
  }));

  // También nombres usados en insumos.proveedor_preferido que aún no están en proveedores.
  const extras = await sqlAll<{ nombre: string }>(
    `SELECT DISTINCT proveedor_preferido as nombre FROM insumos
     WHERE proveedor_preferido IS NOT NULL AND TRIM(proveedor_preferido) != ''`
  );
  const known = new Set(fromTable.map((t) => t.nombre.toLowerCase()));
  for (const e of extras) {
    if (!known.has(e.nombre.toLowerCase())) {
      fromTable.push({
        id: `virt-${e.nombre.toLowerCase().replace(/\s+/g, "-")}`,
        nombre: e.nombre,
        notas: null,
        preferido: false,
      });
    }
  }
  return fromTable.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function upsertTienda(input: {
  id?: string;
  nombre: string;
  notas?: string | null;
  preferido?: boolean;
}): Promise<Tienda> {
  await boot();
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la tienda es obligatorio.");
  const tid = input.id || id();
  const existing = input.id
    ? await sqlGet<{ id: string }>(`SELECT id FROM proveedores WHERE id = ?`, tid)
    : await sqlGet<{ id: string }>(
        `SELECT id FROM proveedores WHERE LOWER(nombre) = LOWER(?)`,
        nombre
      );
  if (existing) {
    await sqlRun(
      `UPDATE proveedores SET nombre = ?, notas = COALESCE(?, notas), preferido = ?
       WHERE id = ?`,
      nombre,
      input.notas ?? null,
      input.preferido ? 1 : 0,
      existing.id
    );
    return (await listTiendas()).find((t) => t.id === existing.id)!;
  }
  await sqlRun(
    `INSERT INTO proveedores (id, nombre, notas, preferido) VALUES (?, ?, ?, ?)`,
    tid,
    nombre,
    input.notas || null,
    input.preferido ? 1 : 0
  );
  return (await listTiendas()).find((t) => t.id === tid)!;
}

/** Autocomplete de insumos por nombre (para líneas de compra). */
export async function buscarInsumosAutocomplete(
  q: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    nombre: string;
    unidad: string;
    stockActual: number;
    stockMinimo: number;
    costoUnitario: number;
    proveedorPreferido: string | null;
    bajoMinimo: boolean;
  }>
> {
  await boot();
  const query = (q || "").trim().toLowerCase();
  const all = await listInsumos();
  const filtered = query
    ? all.filter((i) => i.nombre.toLowerCase().includes(query))
    : all;
  return filtered.slice(0, limit).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    unidad: i.unidad,
    stockActual: i.stockActual,
    stockMinimo: i.stockMinimo,
    costoUnitario: i.costoUnitario,
    proveedorPreferido: i.proveedorPreferido,
    bajoMinimo: i.stockActual <= i.stockMinimo,
  }));
}

/** Alta rápida de insumo nuevo (desde Compras). */
export async function altaRapidaInsumo(input: {
  nombre: string;
  unidad: "g" | "ml" | "u";
  costoUnitario: number;
  cantidad?: number;
  stockMinimo?: number;
  tienda?: string | null;
}): Promise<{
  insumo: Awaited<ReturnType<typeof upsertInsumo>>;
}> {
  await boot();
  const insumo = await upsertInsumo({
    nombre: input.nombre.trim(),
    unidad: input.unidad,
    stockActual: Number(input.cantidad ?? 0),
    stockMinimo: Number(input.stockMinimo ?? 0),
    costoUnitario: Math.round(input.costoUnitario),
    ubicacion: null,
    proveedorPreferido: normalizeTienda(input.tienda),
  });
  return { insumo };
}

/**
 * Explosión de demanda (pedidos + reservas próximas) + ítems bajo mínimo.
 * Si `tienda` viene, prioriza / filtra insumos de esa tienda (proveedor_preferido).
 */
export async function calcularSugerencia(
  diasAdelante = 7,
  opts?: { tienda?: string | null; soloTienda?: boolean }
): Promise<ItemSugerido[]> {
  await boot();
  const desde = hoyISO();
  const hasta = sumarDias(desde, diasAdelante);
  const tienda = normalizeTienda(opts?.tienda);

  const demanda: Record<string, number> = {};
  const lineas = await sqlAll<{ productoId: string; cantidad: number }>(
    `SELECT pl.producto_id as productoId, pl.cantidad
     FROM pedido_lineas pl
     JOIN pedidos p ON p.id = pl.pedido_id
     WHERE p.fecha_entrega >= ? AND p.fecha_entrega <= ?
       AND p.estado IN ('recibido','confirmado','en_produccion')
       AND p.insumos_descontados = 0`,
    desde,
    hasta
  );

  for (const l of lineas) {
    const receta = await getReceta(l.productoId);
    for (const r of receta) {
      demanda[r.insumoId] = (demanda[r.insumoId] || 0) + r.cantidad * l.cantidad;
    }
  }

  // Reservas confirmadas / pendientes con faltante.
  const reservaNec = await sqlAll<{
    insumoId: string;
    faltante: number;
  }>(
    `SELECT n.insumo_id as insumoId, SUM(n.faltante) as faltante
     FROM reserva_necesidades n
     JOIN reservas r ON r.id = n.reserva_id
     WHERE n.requiere_compra = 1
       AND r.estado NOT IN ('cancelada', 'entregada')
       AND r.fecha_entrega >= ? AND r.fecha_entrega <= ?
     GROUP BY n.insumo_id`,
    desde,
    hasta
  );
  const demandaReserva: Record<string, number> = {};
  for (const n of reservaNec) {
    demandaReserva[n.insumoId] = Number(n.faltante) || 0;
    demanda[n.insumoId] =
      (demanda[n.insumoId] || 0) + (Number(n.faltante) || 0);
  }

  const out: ItemSugerido[] = [];
  for (const i of await listInsumos()) {
    const paraTienda = tiendaMatch(i.proveedorPreferido, tienda);
    if (tienda && opts?.soloTienda !== false && !paraTienda) {
      // Si el insumo no tiene tienda preferida, igual lo sugerimos (puede comprarse ahí).
      if (i.proveedorPreferido) continue;
    }

    const reqDemanda = demanda[i.id] || 0;
    const porReserva = demandaReserva[i.id] || 0;
    const stockTrasDemanda = i.stockActual - reqDemanda;
    const porMinimo = Math.max(
      0,
      i.stockMinimo - Math.min(i.stockActual, stockTrasDemanda)
    );
    const porDemanda = Math.max(0, reqDemanda - i.stockActual);
    const cantidad = Math.max(
      porMinimo,
      porDemanda,
      i.stockMinimo - i.stockActual
    );
    if (cantidad <= 0 && i.stockActual > i.stockMinimo) continue;
    if (cantidad <= 0) continue;

    let motivo: ItemSugerido["motivo"] = "bajo_minimo";
    if (porReserva > 0 && (porDemanda > 0 || i.stockActual <= i.stockMinimo)) {
      motivo = "ambos";
    } else if (porReserva > 0) {
      motivo = "reserva";
    } else if (porDemanda > 0 && i.stockActual <= i.stockMinimo) {
      motivo = "ambos";
    } else if (porDemanda > 0) {
      motivo = "demanda";
    }

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
      paraTienda: tienda ? paraTienda || !i.proveedorPreferido : true,
    });
  }

  return out.sort((a, b) => {
    if (tienda && a.paraTienda !== b.paraTienda) {
      return a.paraTienda ? -1 : 1;
    }
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export async function crearListaDesdeSugerencia(
  items?: Array<{
    insumoId: string;
    cantidad: number;
    proveedor?: string | null;
  }>,
  notas?: string | null,
  opts?: { tienda?: string | null }
): Promise<ListaCompra> {
  await boot();
  const tienda = normalizeTienda(opts?.tienda);
  const sugeridos = await calcularSugerencia(7, { tienda });
  const byId = Object.fromEntries(sugeridos.map((s) => [s.insumoId, s]));
  const selected =
    items && items.length
      ? items
      : sugeridos.map((s) => ({
          insumoId: s.insumoId,
          cantidad: s.cantidadSugerida,
          proveedor: s.proveedor ?? tienda,
        }));

  const now = new Date().toISOString();
  const listaId = id();
  await sqlTransaction(async () => {
    await sqlRun(
      `INSERT INTO listas_compra (id, estado, creado_en, notas) VALUES (?, 'lista', ?, ?)`,
      listaId,
      now,
      notas || (tienda ? `Tienda: ${tienda}` : null)
    );
    for (const it of selected) {
      const sug = byId[it.insumoId];
      await sqlRun(
        `INSERT INTO lista_compra_items
         (id, lista_id, insumo_id, cantidad_sugerida, cantidad, proveedor, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id(),
        listaId,
        it.insumoId,
        sug?.cantidadSugerida ?? it.cantidad,
        it.cantidad,
        it.proveedor ?? sug?.proveedor ?? tienda ?? null,
        sug?.motivo ?? "manual"
      );
    }
  });
  return (await getLista(listaId))!;
}

export async function getLista(listaId: string): Promise<ListaCompra | null> {
  await boot();
  const row = await sqlGet<{
    id: string;
    estado: string;
    creadoEn: string;
    notas: string | null;
  }>(
    `SELECT id, estado, creado_en as creadoEn, notas FROM listas_compra WHERE id = ?`,
    listaId
  );
  if (!row) return null;
  const items = await sqlAll<ListaCompra["items"][number]>(
    `SELECT li.id, li.insumo_id as insumoId, i.nombre, i.unidad,
            li.cantidad_sugerida as cantidadSugerida, li.cantidad,
            li.proveedor, li.motivo
     FROM lista_compra_items li
     JOIN insumos i ON i.id = li.insumo_id
     WHERE li.lista_id = ?
     ORDER BY i.nombre`,
    listaId
  );
  return { ...row, items };
}

export async function listListas(
  limit = 20
): Promise<Array<Omit<ListaCompra, "items"> & { itemCount: number }>> {
  await boot();
  return sqlAll<Omit<ListaCompra, "items"> & { itemCount: number }>(
    `SELECT l.id, l.estado, l.creado_en as creadoEn, l.notas,
            (SELECT COUNT(*) FROM lista_compra_items WHERE lista_id = l.id) as itemCount
     FROM listas_compra l
     ORDER BY l.creado_en DESC
     LIMIT ?`,
    limit
  );
}

export async function actualizarItemLista(
  itemId: string,
  cantidad: number,
  proveedor?: string | null
) {
  await boot();
  await sqlRun(
    `UPDATE lista_compra_items SET cantidad = ?, proveedor = COALESCE(?, proveedor) WHERE id = ?`,
    cantidad,
    proveedor ?? null,
    itemId
  );
}

export async function crearCarritoDesdeLista(
  listaId: string,
  proveedor?: string | null,
  tienda?: string | null
): Promise<CarritoCompra> {
  await boot();
  const lista = await getLista(listaId);
  if (!lista) throw new Error("Lista no encontrada");
  const now = new Date().toISOString();
  const carritoId = id();
  const insumos = Object.fromEntries(
    (await listInsumos()).map((i) => [i.id, i])
  );
  const tiendaFinal =
    normalizeTienda(tienda) ||
    normalizeTienda(proveedor) ||
    normalizeTienda(lista.items[0]?.proveedor);

  await sqlTransaction(async () => {
    await sqlRun(
      `INSERT INTO carritos_compra (id, proveedor, tienda, estado, creado_en, comprado_en, notas, total, lista_id)
       VALUES (?, ?, ?, 'lista', ?, NULL, NULL, 0, ?)`,
      carritoId,
      tiendaFinal,
      tiendaFinal,
      now,
      listaId
    );

    let total = 0;
    for (const it of lista.items) {
      const costo = insumos[it.insumoId]?.costoUnitario ?? 0;
      total += Math.round(it.cantidad * costo);
      await sqlRun(
        `INSERT INTO carrito_compra_lineas
         (id, carrito_id, insumo_id, cantidad, costo_unitario, comprada)
         VALUES (?, ?, ?, ?, ?, 0)`,
        id(),
        carritoId,
        it.insumoId,
        it.cantidad,
        costo
      );
    }
    await sqlRun(
      `UPDATE carritos_compra SET total = ? WHERE id = ?`,
      total,
      carritoId
    );
    await sqlRun(
      `UPDATE listas_compra SET estado = 'convertida' WHERE id = ?`,
      listaId
    );
  });
  return (await getCarrito(carritoId))!;
}

export async function crearCarritoManual(
  lineas: Array<{
    insumoId: string;
    cantidad: number;
    costoUnitario?: number;
  }>,
  proveedor?: string | null,
  tienda?: string | null
): Promise<CarritoCompra> {
  await boot();
  const now = new Date().toISOString();
  const carritoId = id();
  const insumos = Object.fromEntries(
    (await listInsumos()).map((i) => [i.id, i])
  );
  const tiendaFinal = normalizeTienda(tienda) || normalizeTienda(proveedor);
  await sqlTransaction(async () => {
    await sqlRun(
      `INSERT INTO carritos_compra (id, proveedor, tienda, estado, creado_en, comprado_en, notas, total, lista_id)
       VALUES (?, ?, ?, 'borrador', ?, NULL, NULL, 0, NULL)`,
      carritoId,
      tiendaFinal,
      tiendaFinal,
      now
    );
    let total = 0;
    for (const l of lineas) {
      const costo = l.costoUnitario ?? insumos[l.insumoId]?.costoUnitario ?? 0;
      total += Math.round(l.cantidad * costo);
      await sqlRun(
        `INSERT INTO carrito_compra_lineas
         (id, carrito_id, insumo_id, cantidad, costo_unitario, comprada)
         VALUES (?, ?, ?, ?, ?, 0)`,
        id(),
        carritoId,
        l.insumoId,
        l.cantidad,
        costo
      );
    }
    await sqlRun(
      `UPDATE carritos_compra SET total = ?, estado = 'lista' WHERE id = ?`,
      total,
      carritoId
    );
  });
  return (await getCarrito(carritoId))!;
}

export async function getCarrito(
  carritoId: string
): Promise<CarritoCompra | null> {
  await boot();
  const row = await sqlGet<Omit<CarritoCompra, "lineas">>(
    `SELECT id, proveedor, tienda, estado, creado_en as creadoEn, comprado_en as compradoEn,
            notas, total FROM carritos_compra WHERE id = ?`,
    carritoId
  );
  if (!row) return null;
  const lineas = await sqlAll<{
    id: string;
    insumoId: string;
    nombre: string;
    unidad: string;
    cantidad: number;
    costoUnitario: number;
    compradaRaw: number;
  }>(
    `SELECT cl.id, cl.insumo_id as insumoId, i.nombre, i.unidad, cl.cantidad,
            cl.costo_unitario as costoUnitario, cl.comprada as compradaRaw
     FROM carrito_compra_lineas cl
     JOIN insumos i ON i.id = cl.insumo_id
     WHERE cl.carrito_id = ?
     ORDER BY i.nombre`,
    carritoId
  );
  return {
    ...row,
    tienda: row.tienda || row.proveedor,
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

export async function listCarritos(limit = 20) {
  await boot();
  return sqlAll(
    `SELECT id, proveedor, tienda, estado, creado_en as creadoEn, comprado_en as compradoEn,
            notas, total FROM carritos_compra
     ORDER BY creado_en DESC LIMIT ?`,
    limit
  );
}

/** Marca carrito comprado: actualiza precios, entra stock y registra gasto */
export async function marcarCarritoComprado(
  carritoId: string,
  opts?: {
    lineasCompradas?: string[]; // ids de línea; si omitido, todas
    registrarGasto?: boolean;
    usuarioId?: string | null;
  }
): Promise<
  { ok: true; carrito: CarritoCompra } | { ok: false; error: string }
> {
  await boot();
  const carrito = await getCarrito(carritoId);
  if (!carrito) return { ok: false, error: "Carrito no encontrado." };
  if (carrito.estado === "comprada") {
    return { ok: false, error: "Este carrito ya está marcado como comprado." };
  }

  const now = new Date().toISOString();
  const idsSet = opts?.lineasCompradas
    ? new Set(opts.lineasCompradas)
    : null;

  await sqlTransaction(async () => {
    let totalComprado = 0;
    for (const l of carrito.lineas) {
      if (idsSet && !idsSet.has(l.id)) continue;
      if (l.comprada) continue;
      await sqlRun(
        `UPDATE insumos SET stock_actual = stock_actual + ?, costo_unitario = ? WHERE id = ?`,
        l.cantidad,
        l.costoUnitario,
        l.insumoId
      );
      await sqlRun(
        `INSERT INTO movimientos_inventario
         (id, insumo_id, tipo, cantidad, costo_unitario, motivo, pedido_id, usuario_id, creado_en)
         VALUES (?, ?, 'entrada', ?, ?, ?, NULL, ?, ?)`,
        id(),
        l.insumoId,
        l.cantidad,
        l.costoUnitario,
        `Compra${carrito.tienda || carrito.proveedor ? ` en ${carrito.tienda || carrito.proveedor}` : ""}`,
        opts?.usuarioId || null,
        now
      );
      await sqlRun(
        `UPDATE carrito_compra_lineas SET comprada = 1 WHERE id = ?`,
        l.id
      );
      totalComprado += Math.round(l.cantidad * l.costoUnitario);
    }

    const pendientesRow = await sqlGet<{ c: number }>(
      `SELECT COUNT(*) as c FROM carrito_compra_lineas WHERE carrito_id = ? AND comprada = 0`,
      carritoId
    );
    const pendientes = pendientesRow?.c ?? 0;

    await sqlRun(
      `UPDATE carritos_compra SET estado = ?, comprado_en = ?, total = ? WHERE id = ?`,
      pendientes > 0 ? "parcial" : "comprada",
      now,
      totalComprado || carrito.total,
      carritoId
    );

    if (opts?.registrarGasto !== false && totalComprado > 0) {
      await sqlRun(
        `INSERT INTO gastos (id, categoria, monto, fecha, metodo_pago, notas, creado_en, comprobante, compra_id)
         VALUES (?, 'insumos', ?, ?, ?, ?, ?, NULL, ?)`,
        id(),
        totalComprado,
        hoyISO(),
        "efectivo",
        `Compra en ${carrito.tienda || carrito.proveedor || "tienda"}`,
        now,
        carritoId
      );
    }
  });
  return { ok: true, carrito: (await getCarrito(carritoId))! };
}

export async function actualizarLineaCarrito(
  lineaId: string,
  data: { cantidad?: number; costoUnitario?: number }
) {
  await boot();
  const row = await sqlGet<{ carritoId: string }>(
    `SELECT carrito_id as carritoId FROM carrito_compra_lineas WHERE id = ?`,
    lineaId
  );
  if (!row) return null;
  if (data.cantidad != null) {
    await sqlRun(
      `UPDATE carrito_compra_lineas SET cantidad = ? WHERE id = ?`,
      data.cantidad,
      lineaId
    );
  }
  if (data.costoUnitario != null) {
    await sqlRun(
      `UPDATE carrito_compra_lineas SET costo_unitario = ? WHERE id = ?`,
      data.costoUnitario,
      lineaId
    );
  }
  const totalRow = await sqlGet<{ t: number }>(
    `SELECT COALESCE(SUM(ROUND(cantidad * costo_unitario)), 0) as t
     FROM carrito_compra_lineas WHERE carrito_id = ?`,
    row.carritoId
  );
  await sqlRun(
    `UPDATE carritos_compra SET total = ? WHERE id = ?`,
    totalRow?.t ?? 0,
    row.carritoId
  );
  return getCarrito(row.carritoId);
}
