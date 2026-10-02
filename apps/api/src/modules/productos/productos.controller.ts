import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  NotFoundException,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request } from "express";
import {
  listProductos,
  listCategorias,
  upsertProducto,
  getProducto,
  getReceta,
  setReceta,
  setProductoFotoUrl,
  costoTeoricoProducto,
} from "../../lib/catalogo";
import { requireUser } from "../../common/session.decorator";
import { aCentavos } from "../../lib/utils";
import {
  deleteStoredMedia,
  productoFotoAliases,
  storeProductImage,
} from "../../lib/media-storage";
import type { ProductoApi } from "../../lib/domain-types";

const FOTO_UPLOAD = FileFieldsInterceptor(
  [
    { name: "foto", maxCount: 1 },
    { name: "file", maxCount: 1 },
    { name: "imagen", maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }
);

type FotoFields = {
  foto?: Express.Multer.File[];
  file?: Express.Multer.File[];
  imagen?: Express.Multer.File[];
};

function pickUploadedFile(
  files?: FotoFields
): Express.Multer.File | undefined {
  if (!files) return undefined;
  return files.foto?.[0] || files.file?.[0] || files.imagen?.[0];
}

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

  let recetaRendimiento: number | undefined;
  if (
    body.receta_rendimiento != null ||
    body.recetaRendimiento != null ||
    body.rinde_piezas != null ||
    body.rindePiezas != null
  ) {
    const n = Number(
      body.receta_rendimiento ??
        body.recetaRendimiento ??
        body.rinde_piezas ??
        body.rindePiezas
    );
    if (!Number.isFinite(n) || n < 1) {
      throw new BadRequestException(
        "receta_rendimiento debe ser un entero ≥ 1."
      );
    }
    recetaRendimiento = Math.floor(n);
  }

  return {
    reservaHabilitada,
    anticipoTipo,
    anticipoValor,
    reservaDiasMinimos,
    reservaCantidadMinima,
    recetaRendimiento,
  };
}

function productoReservaAliases(p: ProductoApi) {
  return {
    ...productoFotoAliases(p.fotoUrl),
    reserva_habilitada: p.reservaHabilitada,
    anticipo_tipo: p.anticipoTipo,
    anticipo_valor: p.anticipoValor,
    reserva_dias_minimos: p.reservaDiasMinimos,
    reserva_cantidad_minima: p.reservaCantidadMinima,
    reservaDiasMinimos: p.reservaDiasMinimos,
    reservaCantidadMinima: p.reservaCantidadMinima,
    receta_rendimiento: p.recetaRendimiento,
    recetaRendimiento: p.recetaRendimiento,
    rinde_piezas: p.recetaRendimiento,
  };
}

/** undefined = no tocar; null/"" = borrar; string = URL externa o pública. */
function parseImagenUrlBody(
  body: Record<string, unknown>
): string | null | undefined {
  const raw =
    body.imagen_url !== undefined
      ? body.imagen_url
      : body.imagenUrl !== undefined
        ? body.imagenUrl
        : body.foto_url !== undefined
          ? body.foto_url
          : body.fotoUrl !== undefined
            ? body.fotoUrl
            : undefined;
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const s = String(raw).trim();
  return s || null;
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
      recetaRendimiento: reserva.recetaRendimiento ?? 1,
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

  /** Contrato: PATCH /api/productos/:id (reserva_habilitada, anticipo, imagen_url, etc.). */
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

  /**
   * Subir / reemplazar foto (multipart).
   * Campos aceptados: `foto` | `file` | `imagen` — jpg/png/webp ≤ 5 MB.
   */
  @Post(":id/foto")
  @HttpCode(200)
  @UseInterceptors(FOTO_UPLOAD)
  async uploadFoto(
    @Req() req: Request,
    @Param("id") id: string,
    @UploadedFiles() files?: FotoFields
  ) {
    await requireUser(req, ["admin"]);
    return this.saveUploadedFoto(id, pickUploadedFile(files));
  }

  /** Alias de POST :id/foto. */
  @Post(":id/imagen")
  @HttpCode(200)
  @UseInterceptors(FOTO_UPLOAD)
  async uploadImagen(
    @Req() req: Request,
    @Param("id") id: string,
    @UploadedFiles() files?: FotoFields
  ) {
    await requireUser(req, ["admin"]);
    return this.saveUploadedFoto(id, pickUploadedFile(files));
  }

  /** Borrar foto del producto (archivo local/S3 + columna). */
  @Delete(":id/foto")
  async deleteFoto(@Req() req: Request, @Param("id") id: string) {
    await requireUser(req, ["admin"]);
    const existing = await getProducto(id);
    if (!existing) throw new NotFoundException("Producto no encontrado.");
    await deleteStoredMedia(existing.fotoUrl);
    const producto = await setProductoFotoUrl(id, null);
    return {
      ok: true,
      producto: {
        ...producto,
        ...productoReservaAliases(producto),
        precio_venta: producto.precio,
      },
    };
  }

  @Delete(":id/imagen")
  async deleteImagen(@Req() req: Request, @Param("id") id: string) {
    return this.deleteFoto(req, id);
  }

  private async saveUploadedFoto(
    id: string,
    file: Express.Multer.File | undefined
  ) {
    const existing = await getProducto(id);
    if (!existing) throw new NotFoundException("Producto no encontrado.");

    if (!file?.buffer?.length) {
      throw new BadRequestException(
        "Falta archivo multipart (campo foto, file o imagen)."
      );
    }

    let stored;
    try {
      stored = await storeProductImage(id, {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      });
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : "No se pudo guardar la imagen."
      );
    }

    await deleteStoredMedia(existing.fotoUrl);
    const producto = await setProductoFotoUrl(id, stored.publicUrl);
    return {
      ok: true,
      storage: stored.storage,
      producto: {
        ...producto,
        ...productoReservaAliases(producto),
        precio_venta: producto.precio,
      },
    };
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
      recetaRendimiento: reserva.recetaRendimiento,
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

    const imagenUrl = parseImagenUrlBody(body);
    let productoFinal = producto;
    if (imagenUrl !== undefined) {
      const next = imagenUrl ? String(imagenUrl).trim() || null : null;
      if (next !== (producto.fotoUrl ?? null)) {
        if (!next) {
          await deleteStoredMedia(producto.fotoUrl);
        }
        productoFinal = await setProductoFotoUrl(id, next);
      }
    }

    const costo = await costoTeoricoProducto(productoFinal.id);
    return {
      producto: {
        ...productoFinal,
        ...productoReservaAliases(productoFinal),
        precio_venta: productoFinal.precio,
      },
      receta: await getReceta(productoFinal.id),
      costoTeorico: costo,
      costo_calculado: costo,
      costoCalculado: costo,
    };
  }
}
