import { sqlAll, sqlGet, sqlRun, sqlTransaction } from "./db";
import { ensureSeed } from "./seed";
import { getConfigPublica } from "./config";
import { id } from "./id";
import { cdmxLocalToUtcIso, deadlineVigente } from "./utils";
import type {
  Categoria,
  DiaOperativo,
  Insumo,
  ZonaEnvio,
} from "../../../../shared/types";
import type {
  AnticipoTipo,
  LineaRecetaApi,
  MenuHoyResponse,
  ProductoApi,
} from "./domain-types";

async function boot() {
  await ensureSeed();
}

/** Filas SQLite traen 0/1 donde el tipo de dominio usa boolean. */
type SqliteBool<T, K extends keyof T> = Omit<T, K> & { [P in K]: number };

export async function listCategorias(): Promise<Categoria[]> {
  await boot();
  const rows = await sqlAll<{
    id: string;
    nombre: string;
    orden: number;
    activa: number;
  }>(`SELECT id, nombre, orden, activa FROM categorias ORDER BY orden, nombre`);
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    orden: r.orden,
    activa: !!r.activa,
  }));
}

type ProductoRow = {
  id: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: number;
  fotoUrl: string | null;
  alergenos: string | null;
  orden: number;
  reservaHabilitada: number;
  categoriaNombre?: string | null;
  duraciones: string | null;
  anticipoTipo: string | null;
  anticipoValor: number | null;
  reservaDiasMinimos: number | null;
  reservaCantidadMinima: number | null;
  recetaRendimiento: number | null;
};

/** Normaliza rendimiento de lote (≥ 1). Default 1 = comportamiento por pieza. */
export function normalizarRendimiento(
  n: number | null | undefined
): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.floor(v);
}

/** Insumo por 1 pieza = cantidad_lote / rendimiento. */
export function cantidadInsumoPorPieza(
  cantidadLote: number,
  rendimiento: number
): number {
  return Number(cantidadLote) / normalizarRendimiento(rendimiento);
}

/**
 * Necesidad de insumo para N piezas pedidas.
 * Unidades discretas (`u`) se redondean hacia arriba; g/ml quedan decimales.
 */
export function cantidadInsumoParaPiezas(
  cantidadLote: number,
  rendimiento: number,
  piezas: number,
  unidad?: string | null
): number {
  const raw =
    Number(piezas) *
    cantidadInsumoPorPieza(cantidadLote, rendimiento);
  if (unidad === "u") {
    return Math.ceil(Math.max(0, raw) - 1e-9);
  }
  return Math.max(0, raw);
}

function mapProducto(r: ProductoRow): ProductoApi {
  const anticipoTipo: AnticipoTipo =
    r.anticipoTipo === "monto" ? "monto" : "porcentaje";
  const dias =
    r.reservaDiasMinimos != null && Number.isFinite(Number(r.reservaDiasMinimos))
      ? Math.max(0, Math.floor(Number(r.reservaDiasMinimos)))
      : 3;
  const qtyMin =
    r.reservaCantidadMinima != null &&
    Number.isFinite(Number(r.reservaCantidadMinima))
      ? Math.max(1, Math.floor(Number(r.reservaCantidadMinima)))
      : 1;
  return {
    id: r.id,
    categoriaId: r.categoriaId,
    nombre: r.nombre,
    descripcion: r.descripcion,
    precio: r.precio,
    activoCatalogo: !!r.activoCatalogo,
    fotoUrl: r.fotoUrl,
    alergenos: r.alergenos,
    orden: r.orden,
    reservaHabilitada: !!r.reservaHabilitada,
    anticipoTipo,
    anticipoValor: r.anticipoValor ?? (anticipoTipo === "porcentaje" ? 50 : 0),
    reservaDiasMinimos: dias,
    reservaCantidadMinima: qtyMin,
    recetaRendimiento: normalizarRendimiento(r.recetaRendimiento),
    duraciones: parseDuraciones(r.duraciones),
    ...(r.categoriaNombre !== undefined
      ? { categoriaNombre: r.categoriaNombre }
      : {}),
  };
}

export function calcularAnticipoUnitario(
  precio: number,
  tipo: AnticipoTipo,
  valor: number
): number {
  if (tipo === "monto") return Math.max(0, Math.round(valor));
  const pct = Math.min(100, Math.max(0, valor));
  return Math.round((precio * pct) / 100);
}

export async function listProductos(): Promise<
  Array<ProductoApi & { categoriaNombre: string | null }>
> {
  await boot();
  const rows = await sqlAll<ProductoRow>(
    `SELECT p.id, p.categoria_id as categoriaId, p.nombre, p.descripcion,
            p.precio, p.activo_catalogo as activoCatalogo, p.foto_url as fotoUrl,
            p.alergenos, p.orden, p.duraciones,
            COALESCE(p.reserva_habilitada, 0) as reservaHabilitada,
            COALESCE(p.anticipo_tipo, 'porcentaje') as anticipoTipo,
            COALESCE(p.anticipo_valor, 50) as anticipoValor,
            COALESCE(p.reserva_dias_minimos, 3) as reservaDiasMinimos,
            COALESCE(p.reserva_cantidad_minima, 1) as reservaCantidadMinima,
            COALESCE(p.receta_rendimiento, 1) as recetaRendimiento,
            c.nombre as categoriaNombre
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     ORDER BY p.orden, p.nombre`
  );
  return rows.map((r) => {
    const p = mapProducto(r);
    return { ...p, categoriaNombre: r.categoriaNombre ?? null };
  });
}

function parseDuraciones(
  raw: string | null | undefined
): ProductoApi["duraciones"] {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getProducto(idProd: string): Promise<ProductoApi | null> {
  await boot();
  const r = await sqlGet<ProductoRow>(
    `SELECT id, categoria_id as categoriaId, nombre, descripcion, precio,
            activo_catalogo as activoCatalogo, foto_url as fotoUrl, alergenos, orden,
            duraciones,
            COALESCE(reserva_habilitada, 0) as reservaHabilitada,
            COALESCE(anticipo_tipo, 'porcentaje') as anticipoTipo,
            COALESCE(anticipo_valor, 50) as anticipoValor,
            COALESCE(reserva_dias_minimos, 3) as reservaDiasMinimos,
            COALESCE(reserva_cantidad_minima, 1) as reservaCantidadMinima,
            COALESCE(receta_rendimiento, 1) as recetaRendimiento
     FROM productos WHERE id = ?`,
    idProd
  );
  if (!r) return null;
  return mapProducto(r);
}

export async function upsertProducto(data: {
  id?: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: boolean;
  alergenos: string | null;
  orden?: number;
  duraciones?: ProductoApi["duraciones"];
  reservaHabilitada?: boolean;
  anticipoTipo?: AnticipoTipo;
  anticipoValor?: number;
  reservaDiasMinimos?: number;
  reservaCantidadMinima?: number;
  recetaRendimiento?: number;
}): Promise<ProductoApi> {
  await boot();
  const pid = data.id || id();
  const duracionesJson =
    data.duraciones != null ? JSON.stringify(data.duraciones) : null;
  const existing = data.id ? await getProducto(data.id) : null;
  const reservaHabilitada =
    data.reservaHabilitada ?? existing?.reservaHabilitada ?? false;
  const anticipoTipo =
    data.anticipoTipo ?? existing?.anticipoTipo ?? "porcentaje";
  const anticipoValor =
    data.anticipoValor ??
    existing?.anticipoValor ??
    (anticipoTipo === "porcentaje" ? 50 : 0);
  const reservaDiasMinimos = Math.max(
    0,
    Math.floor(
      data.reservaDiasMinimos ?? existing?.reservaDiasMinimos ?? 3
    )
  );
  const reservaCantidadMinima = Math.max(
    1,
    Math.floor(
      data.reservaCantidadMinima ?? existing?.reservaCantidadMinima ?? 1
    )
  );
  const recetaRendimiento = normalizarRendimiento(
    data.recetaRendimiento ?? existing?.recetaRendimiento ?? 1
  );
  if (data.id) {
    await sqlRun(
      `UPDATE productos SET categoria_id=?, nombre=?, descripcion=?, precio=?,
       activo_catalogo=?, alergenos=?, orden=?, duraciones=?,
       reserva_habilitada=?, anticipo_tipo=?, anticipo_valor=?,
       reserva_dias_minimos=?, reserva_cantidad_minima=?,
       receta_rendimiento=? WHERE id=?`,
      data.categoriaId,
      data.nombre,
      data.descripcion,
      data.precio,
      data.activoCatalogo ? 1 : 0,
      data.alergenos,
      data.orden ?? 0,
      duracionesJson,
      reservaHabilitada ? 1 : 0,
      anticipoTipo,
      anticipoValor,
      reservaDiasMinimos,
      reservaCantidadMinima,
      recetaRendimiento,
      pid
    );
  } else {
    await sqlRun(
      `INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, activo_catalogo, foto_url, alergenos, orden, duraciones, reserva_habilitada, anticipo_tipo, anticipo_valor, reserva_dias_minimos, reserva_cantidad_minima, receta_rendimiento)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      pid,
      data.categoriaId,
      data.nombre,
      data.descripcion,
      data.precio,
      data.activoCatalogo ? 1 : 0,
      data.alergenos,
      data.orden ?? 0,
      duracionesJson,
      reservaHabilitada ? 1 : 0,
      anticipoTipo,
      anticipoValor,
      reservaDiasMinimos,
      reservaCantidadMinima,
      recetaRendimiento
    );
  }
  return (await getProducto(pid))!;
}

export async function listInsumos(): Promise<Insumo[]> {
  await boot();
  return sqlAll<Insumo>(
    `SELECT id, nombre, unidad, stock_actual as stockActual, stock_minimo as stockMinimo,
            costo_unitario as costoUnitario, ubicacion, proveedor_preferido as proveedorPreferido
     FROM insumos ORDER BY nombre`
  );
}

export async function upsertInsumo(data: {
  id?: string;
  nombre: string;
  unidad: Insumo["unidad"];
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  ubicacion: string | null;
  proveedorPreferido: string | null;
}): Promise<Insumo> {
  await boot();
  const iid = data.id || id();
  if (data.id) {
    await sqlRun(
      `UPDATE insumos SET nombre=?, unidad=?, stock_actual=?, stock_minimo=?,
       costo_unitario=?, ubicacion=?, proveedor_preferido=? WHERE id=?`,
      data.nombre,
      data.unidad,
      data.stockActual,
      data.stockMinimo,
      data.costoUnitario,
      data.ubicacion,
      data.proveedorPreferido,
      iid
    );
  } else {
    await sqlRun(
      `INSERT INTO insumos (id, nombre, unidad, stock_actual, stock_minimo, costo_unitario, ubicacion, proveedor_preferido)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      iid,
      data.nombre,
      data.unidad,
      data.stockActual,
      data.stockMinimo,
      data.costoUnitario,
      data.ubicacion,
      data.proveedorPreferido
    );
  }
  return (await listInsumos()).find((i) => i.id === iid)!;
}

export async function getReceta(
  productoId: string
): Promise<LineaRecetaApi[]> {
  await boot();
  const producto = await getProducto(productoId);
  const rendimiento = normalizarRendimiento(producto?.recetaRendimiento);
  const rows = await sqlAll<{
    id: string;
    productoId: string;
    insumoId: string;
    cantidad: number;
    insumoNombre: string;
    unidad: "g" | "ml" | "u";
  }>(
    `SELECT r.id, r.producto_id as productoId, r.insumo_id as insumoId, r.cantidad,
            i.nombre as insumoNombre, i.unidad
     FROM receta_lineas r
     JOIN insumos i ON i.id = r.insumo_id
     WHERE r.producto_id = ?
     ORDER BY i.nombre`,
    productoId
  );
  return rows.map((r) => {
    const cantidadLote = Number(r.cantidad);
    const porPieza = cantidadInsumoPorPieza(cantidadLote, rendimiento);
    return {
      id: r.id,
      productoId: r.productoId,
      insumoId: r.insumoId,
      cantidad: cantidadLote,
      cantidad_lote: cantidadLote,
      por_pieza: porPieza,
      insumoNombre: r.insumoNombre,
      unidad: r.unidad,
    };
  });
}

export async function setReceta(
  productoId: string,
  lineas: Array<{ insumoId: string; cantidad: number }>
) {
  await boot();
  await sqlTransaction(async () => {
    await sqlRun(`DELETE FROM receta_lineas WHERE producto_id = ?`, productoId);
    for (const l of lineas) {
      if (l.cantidad <= 0) continue;
      await sqlRun(
        `INSERT INTO receta_lineas (id, producto_id, insumo_id, cantidad) VALUES (?, ?, ?, ?)`,
        id(),
        productoId,
        l.insumoId,
        l.cantidad
      );
    }
  });
  return getReceta(productoId);
}

/** Costo teórico por pieza = Σ (insumo_por_pieza × costo_unitario). */
export async function costoTeoricoProducto(productoId: string): Promise<number> {
  const producto = await getProducto(productoId);
  const rendimiento = normalizarRendimiento(producto?.recetaRendimiento);
  const lineas = await getReceta(productoId);
  const insumos = Object.fromEntries(
    (await listInsumos()).map((i) => [i.id, i])
  );
  return lineas.reduce((acc, l) => {
    const i = insumos[l.insumoId];
    if (!i) return acc;
    const porPieza = cantidadInsumoPorPieza(l.cantidad, rendimiento);
    return acc + Math.round(porPieza * i.costoUnitario);
  }, 0);
}

export async function listDias(
  from: string,
  to: string
): Promise<DiaOperativo[]> {
  await boot();
  const rows = await sqlAll<SqliteBool<DiaOperativo, "abierto">>(
    `SELECT id, fecha, abierto, deadline_pedido as deadlinePedido,
            cupo_maximo as cupoMaximo, notas
     FROM dias_operativos
     WHERE fecha >= ? AND fecha <= ?
     ORDER BY fecha`,
    from,
    to
  );
  return rows.map((d) => ({ ...d, abierto: !!d.abierto }));
}

export async function getDia(fecha: string): Promise<DiaOperativo | null> {
  await boot();
  const d = await sqlGet<SqliteBool<DiaOperativo, "abierto">>(
    `SELECT id, fecha, abierto, deadline_pedido as deadlinePedido,
            cupo_maximo as cupoMaximo, notas
     FROM dias_operativos WHERE fecha = ?`,
    fecha
  );
  if (!d) return null;
  return { ...d, abierto: !!d.abierto };
}

export async function upsertDia(data: {
  fecha: string;
  abierto: boolean;
  deadlinePedido: string;
  cupoMaximo: number | null;
  notas: string | null;
}): Promise<DiaOperativo> {
  await boot();
  const existing = await getDia(data.fecha);
  if (existing) {
    await sqlRun(
      `UPDATE dias_operativos SET abierto=?, deadline_pedido=?, cupo_maximo=?, notas=? WHERE fecha=?`,
      data.abierto ? 1 : 0,
      data.deadlinePedido,
      data.cupoMaximo,
      data.notas,
      data.fecha
    );
  } else {
    await sqlRun(
      `INSERT INTO dias_operativos (id, fecha, abierto, deadline_pedido, cupo_maximo, notas)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id(),
      data.fecha,
      data.abierto ? 1 : 0,
      data.deadlinePedido,
      data.cupoMaximo,
      data.notas
    );
  }
  return (await getDia(data.fecha))!;
}

export async function getDisponibilidad(fecha: string): Promise<
  Array<{
    productoId: string;
    disponible: boolean;
    productoNombre: string;
  }>
> {
  await boot();
  const rows = await sqlAll<{
    productoId: string;
    disponible: number;
    productoNombre: string;
  }>(
    `SELECT d.producto_id as productoId, d.disponible, p.nombre as productoNombre
     FROM disponibilidad_producto_dia d
     JOIN productos p ON p.id = d.producto_id
     WHERE d.fecha = ?
     ORDER BY p.orden, p.nombre`,
    fecha
  );

  if (rows.length === 0) {
    // Si no hay filas, devolver todos los productos del catálogo como no configurados
    return (await listProductos()).map((p) => ({
      productoId: p.id,
      disponible: false,
      productoNombre: p.nombre,
    }));
  }
  return rows.map((r) => ({
    productoId: r.productoId,
    disponible: !!r.disponible,
    productoNombre: r.productoNombre,
  }));
}

export async function setDisponibilidad(
  fecha: string,
  items: Array<{ productoId: string; disponible: boolean }>
) {
  await boot();
  await sqlTransaction(async () => {
    for (const it of items) {
      await sqlRun(
        `INSERT INTO disponibilidad_producto_dia (id, fecha, producto_id, disponible)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(fecha, producto_id) DO UPDATE SET disponible = excluded.disponible`,
        id(),
        fecha,
        it.productoId,
        it.disponible ? 1 : 0
      );
    }
  });
  return getDisponibilidad(fecha);
}

export async function copiarDisponibilidad(desde: string, hacia: string) {
  const items = (await getDisponibilidad(desde)).map((i) => ({
    productoId: i.productoId,
    disponible: i.disponible,
  }));
  return setDisponibilidad(hacia, items);
}

export async function listZonas(): Promise<ZonaEnvio[]> {
  await boot();
  const rows = await sqlAll<SqliteBool<ZonaEnvio, "activa">>(
    `SELECT id, nombre, cobertura, costo_envio as costoEnvio, activa
     FROM zonas_envio ORDER BY nombre`
  );
  return rows.map((z) => ({ ...z, activa: !!z.activa }));
}

export async function getMenuPorDia(fecha: string): Promise<MenuHoyResponse> {
  await boot();
  const dia = await getDia(fecha);
  const config = await getConfigPublica();
  const categorias = (await listCategorias()).filter((c) => c.activa);
  const zonas = (await listZonas()).filter((z) => z.activa);
  const disp = Object.fromEntries(
    (await getDisponibilidad(fecha)).map((d) => [d.productoId, d.disponible])
  );
  const productos = (await listProductos())
    .filter((p) => p.activoCatalogo)
    .map((p) => ({
      ...p,
      disponible: !!disp[p.id],
      categoriaNombre: p.categoriaNombre ?? null,
    }))
    .filter((p) => p.disponible);

  const deadline = dia?.deadlinePedido || cdmxLocalToUtcIso(fecha, "00:00");
  const vigente = deadlineVigente(deadline);
  const diaAbierto = dia ? !!dia.abierto : false;
  const acepta = diaAbierto && vigente;

  return {
    fecha,
    abierto: acepta,
    hora_limite: deadline,
    horaLimite: deadline,
    deadlinePedido: deadline,
    deadlineVigente: vigente,
    acepta_pedidos: acepta,
    aceptaPedidos: acepta,
    cupoMaximo: dia?.cupoMaximo ?? null,
    productos,
    categorias,
    zonas,
    config,
  };
}

/** Shape staff: menú del día + hora_limite + productos con flag activo. */
export async function getMenuDiaStaff(fecha: string) {
  await boot();
  const dia = await getDia(fecha);
  const disponibilidad = await getDisponibilidad(fecha);
  const deadline = dia?.deadlinePedido || null;
  return {
    fecha,
    // Sin fila aún → default abierto (programar/activar implica vender).
    abierto: dia?.abierto ?? true,
    hora_limite: deadline,
    horaLimite: deadline,
    deadlinePedido: deadline,
    cupoMaximo: dia?.cupoMaximo ?? null,
    notas: dia?.notas ?? null,
    dia,
    productos: disponibilidad.map((d) => ({
      producto_id: d.productoId,
      productoId: d.productoId,
      nombre: d.productoNombre,
      activo: d.disponible,
      disponible: d.disponible,
    })),
    disponibilidad,
  };
}

export async function programarMenuDia(input: {
  fecha: string;
  horaLimite?: string | null;
  deadlinePedido?: string | null;
  abierto?: boolean;
  cupoMaximo?: number | null;
  notas?: string | null;
  productos?: Array<{ productoId: string; activo?: boolean; disponible?: boolean }>;
  copiarDesde?: string | null;
}) {
  await boot();
  if (input.copiarDesde) {
    await copiarDisponibilidad(input.copiarDesde, input.fecha);
  }

  let deadlinePedido =
    input.deadlinePedido ||
    (await getDia(input.fecha))?.deadlinePedido ||
    cdmxLocalToUtcIso(input.fecha, "18:00");

  if (input.horaLimite && /^\d{2}:\d{2}(:\d{2})?$/.test(input.horaLimite)) {
    // HH:mm interpretado en America/Mexico_City para esa fecha civil.
    deadlinePedido = cdmxLocalToUtcIso(input.fecha, input.horaLimite);
  } else if (input.horaLimite && !input.deadlinePedido) {
    // ISO u otro parseable → instant absoluto
    deadlinePedido = new Date(input.horaLimite).toISOString();
  } else if (input.deadlinePedido) {
    deadlinePedido = new Date(input.deadlinePedido).toISOString();
  }

  const existing = await getDia(input.fecha);
  const productosPayload = Array.isArray(input.productos)
    ? input.productos
    : null;
  const hasActivos =
    productosPayload != null &&
    productosPayload.some((p) => p.activo ?? p.disponible);

  // Activar productos del día implica abrir pedidos, salvo cierre explícito.
  const abierto =
    input.abierto !== undefined
      ? !!input.abierto
      : hasActivos
        ? true
        : (existing?.abierto ?? true);

  await upsertDia({
    fecha: input.fecha,
    abierto,
    deadlinePedido,
    cupoMaximo:
      input.cupoMaximo !== undefined
        ? input.cupoMaximo
        : (existing?.cupoMaximo ?? 20),
    notas:
      input.notas !== undefined ? input.notas : (existing?.notas ?? null),
  });

  if (productosPayload) {
    await setDisponibilidad(
      input.fecha,
      productosPayload.map((p) => ({
        productoId: p.productoId,
        disponible: p.activo ?? p.disponible ?? false,
      }))
    );
  }

  return getMenuDiaStaff(input.fecha);
}
