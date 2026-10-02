import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  BadRequestException,
  HttpCode,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  listProductos,
  listCategorias,
  upsertProducto,
  getProducto,
  getReceta,
  setReceta,
  costoTeoricoProducto,
} from "../../lib/catalogo";
import { requireUser } from "../../common/session.decorator";
import { aCentavos } from "../../lib/utils";
import type { ProductoApi } from "../../lib/domain-types";

function parseDuracionesBody(
  body: Record<string, unknown>
): ProductoApi["duraciones"] | undefined {
  if (Array.isArray(body.duraciones)) {
    return body.duraciones as ProductoApi["duraciones"];
  }
  if (body.duracionesTexto != null) {
    return String(body.duracionesTexto)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((etiqueta, i) => ({ id: `d${i + 1}`, etiqueta }));
  }
  return undefined;
}

function parseReservaFields(body: Record<string, unknown>) {
  const reservaHabilitada =
    body.reserva_habilitada != null
      ? body.reserva_habilitada === true || body.reserva_habilitada === 1
      : body.reservaHabilitada != null
        ? body.reservaHabilitada === true
        : undefined;
  const anticipoTipoRaw =
    (body.anticipo_tipo as string) || (body.anticipoTipo as string);
  const anticipoTipo =
    anticipoTipoRaw === "monto"
      ? ("monto" as const)
      : anticipoTipoRaw === "porcentaje"
        ? ("porcentaje" as const)
        : undefined;
  let anticipoValor: number | undefined;
  if (body.anticipo_valor != null || body.anticipoValor != null) {
    anticipoValor = Number(body.anticipo_valor ?? body.anticipoValor);
  } else if (body.anticipoPesos != null) {
    anticipoValor = aCentavos(Number(body.anticipoPesos));
  } else if (body.anticipoPct != null) {
    anticipoValor = Number(body.anticipoPct);
  }

  let reservaDiasMinimos: number | undefined;
  if (
    body.reserva_dias_minimos != null ||
    body.reservaDiasMinimos != null
  ) {
    const n = Number(body.reserva_dias_minimos ?? body.reservaDiasMinimos);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException(
        "reserva_dias_minimos debe ser un entero ≥ 0."
      );
    }
    reservaDiasMinimos = Math.floor(n);
  }

  let reservaCantidadMinima: number | undefined;
  if (
    body.reserva_cantidad_minima != null ||
    body.reservaCantidadMinima != null
  ) {
    const n = Number(
      body.reserva_cantidad_minima ?? body.reservaCantidadMinima
    );
    if (!Number.isFinite(n) || n < 1) {
      throw new BadRequestException(
        "reserva_cantidad_minima debe ser un entero ≥ 1."
      );
    }
    reservaCantidadMinima = Math.floor(n);
  }

  return {
    reservaHabilitada,
    anticipoTipo,
    anticipoValor,
    reservaDiasMinimos,
    reservaCantidadMinima,
  };
}

function productoReservaAliases(p: ProductoApi) {
  return {
    reserva_habilitada: p.reservaHabilitada,
    anticipo_tipo: p.anticipoTipo,
    anticipo_valor: p.anticipoValor,
    reserva_dias_minimos: p.reservaDiasMinimos,
    reserva_cantidad_minima: p.reservaCantidadMinima,
    reservaDiasMinimos: p.reservaDiasMinimos,
    reservaCantidadMinima: p.reservaCantidadMinima,
  };
}

@Controller("productos")
export class ProductosController {
  @Get()
  async list(@Req() req: Request) {
    await requireUser(req);
    const productosRaw = await listProductos();
    const productos = [];
    for (const p of productosRaw) {
      const costo = await costoTeoricoProducto(p.id);
      const margen =
        p.precio > 0
          ? Math.round(((p.precio - costo) / p.precio) * 1000) / 10
          : 0;
      productos.push({
        ...p,
        ...productoReservaAliases(p),
        costoTeorico: costo,
        costo_calculado: costo,
        costoCalculado: costo,
        precio_venta: p.precio,
        margenPct: margen,
        receta: await getReceta(p.id),
      });
    }
    return { productos, categorias: await listCategorias() };
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.nombre) throw new BadRequestException("El nombre es obligatorio.");
    const precio =
      typeof body.precio === "number"
        ? body.precio > 1000
          ? Math.round(body.precio)
          : aCentavos(body.precio)
        : body.precio_venta != null
          ? typeof body.precio_venta === "number" && body.precio_venta > 1000
            ? Math.round(Number(body.precio_venta))
            : aCentavos(Number(body.precio_venta))
          : aCentavos(Number(body.precioPesos || 0));
    const reserva = parseReservaFields(body);

    const producto = await upsertProducto({
      categoriaId: (body.categoriaId as string) || null,
      nombre: String(body.nombre),
      descripcion: (body.descripcion as string) || null,
      precio,
      activoCatalogo: body.activoCatalogo !== false,
      alergenos: (body.alergenos as string) || null,
      orden: (body.orden as number) ?? 0,
      duraciones: parseDuracionesBody(body),
      reservaHabilitada: reserva.reservaHabilitada ?? false,
      anticipoTipo: reserva.anticipoTipo ?? "porcentaje",
      anticipoValor: reserva.anticipoValor ?? 50,
      reservaDiasMinimos: reserva.reservaDiasMinimos ?? 3,
      reservaCantidadMinima: reserva.reservaCantidadMinima ?? 1,
    });

    if (Array.isArray(body.receta)) {
      await setReceta(
        producto.id,
        body.receta.map((r: { insumoId: string; cantidad: number }) => ({
          insumoId: r.insumoId,
          cantidad: Number(r.cantidad),
        }))
      );
    }

    const costo = await costoTeoricoProducto(producto.id);
    return {
      producto: {
        ...producto,
        ...productoReservaAliases(producto),
        precio_venta: producto.precio,
      },
      receta: await getReceta(producto.id),
      costoTeorico: costo,
      costo_calculado: costo,
      costoCalculado: costo,
    };
  }

  @Put()
  async update(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.id) throw new BadRequestException("Falta id.");
    return this.applyUpdate(String(body.id), body);
  }

  /** Contrato: PATCH /api/productos/:id (reserva_habilitada, anticipo, etc.). */
  @Patch(":id")
  async patchOne(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    await requireUser(req, ["admin"]);
    const existing = await getProducto(id);
    if (!existing) throw new NotFoundException("Producto no encontrado.");
    return this.applyUpdate(id, {
      ...body,
      id,
      nombre: body.nombre ?? existing.nombre,
      categoriaId:
        body.categoriaId !== undefined
          ? body.categoriaId
          : existing.categoriaId,
      descripcion:
        body.descripcion !== undefined
          ? body.descripcion
          : existing.descripcion,
      alergenos:
        body.alergenos !== undefined ? body.alergenos : existing.alergenos,
      activoCatalogo:
        body.activoCatalogo !== undefined
          ? body.activoCatalogo
          : existing.activoCatalogo,
      orden: body.orden !== undefined ? body.orden : existing.orden,
      precio:
        body.precio !== undefined
          ? body.precio
          : body.precioPesos !== undefined
            ? undefined
            : existing.precio,
    });
  }

  private async applyUpdate(id: string, body: Record<string, unknown>) {
    const existing = await getProducto(id);
    if (!existing) throw new NotFoundException("Producto no encontrado.");

    const precio =
      typeof body.precio === "number"
        ? body.precio > 1000
          ? Math.round(body.precio)
          : body.precio < 1000 && body.precio % 1 !== 0
            ? aCentavos(body.precio)
            : Math.round(body.precio)
        : body.precio_venta != null
          ? typeof body.precio_venta === "number" &&
            Number(body.precio_venta) > 1000
            ? Math.round(Number(body.precio_venta))
            : aCentavos(Number(body.precio_venta))
          : body.precioPesos != null
            ? aCentavos(Number(body.precioPesos))
            : existing.precio;

    const reserva = parseReservaFields(body);
    const producto = await upsertProducto({
      id,
      categoriaId:
        body.categoriaId !== undefined
          ? ((body.categoriaId as string) ?? null)
          : existing.categoriaId,
      nombre: String(body.nombre ?? existing.nombre),
      descripcion:
        body.descripcion !== undefined
          ? ((body.descripcion as string) ?? null)
          : existing.descripcion,
      precio,
      activoCatalogo:
        body.activoCatalogo !== undefined
          ? body.activoCatalogo !== false
          : existing.activoCatalogo,
      alergenos:
        body.alergenos !== undefined
          ? ((body.alergenos as string) ?? null)
          : existing.alergenos,
      orden: (body.orden as number) ?? existing.orden,
      duraciones: parseDuracionesBody(body) ?? existing.duraciones,
      reservaHabilitada: reserva.reservaHabilitada,
      anticipoTipo: reserva.anticipoTipo,
      anticipoValor: reserva.anticipoValor,
      reservaDiasMinimos: reserva.reservaDiasMinimos,
      reservaCantidadMinima: reserva.reservaCantidadMinima,
    });

    if (Array.isArray(body.receta)) {
      await setReceta(
        producto.id,
        body.receta.map((r: { insumoId: string; cantidad: number }) => ({
          insumoId: r.insumoId,
          cantidad: Number(r.cantidad),
        }))
      );
    }

    const costo = await costoTeoricoProducto(producto.id);
    return {
      producto: {
        ...producto,
        ...productoReservaAliases(producto),
        precio_venta: producto.precio,
      },
      receta: await getReceta(producto.id),
      costoTeorico: costo,
      costo_calculado: costo,
      costoCalculado: costo,
    };
  }
}
