import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  BadRequestException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import {
  listProductos,
  listCategorias,
  upsertProducto,
  getReceta,
  setReceta,
  costoTeoricoProducto,
} from "../../lib/catalogo";
import { requireUser } from "../../common/session.decorator";
import { aCentavos } from "../../lib/utils";

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
        costoTeorico: costo,
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
        : aCentavos(Number(body.precioPesos || 0));

    const producto = await upsertProducto({
      categoriaId: (body.categoriaId as string) || null,
      nombre: String(body.nombre),
      descripcion: (body.descripcion as string) || null,
      precio,
      activoCatalogo: body.activoCatalogo !== false,
      alergenos: (body.alergenos as string) || null,
      orden: (body.orden as number) ?? 0,
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

    return { producto, receta: await getReceta(producto.id) };
  }

  @Put()
  async update(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.id) throw new BadRequestException("Falta id.");
    const precio =
      typeof body.precio === "number"
        ? body.precio > 1000
          ? Math.round(body.precio)
          : aCentavos(body.precio)
        : undefined;

    const producto = await upsertProducto({
      id: String(body.id),
      categoriaId: (body.categoriaId as string) ?? null,
      nombre: String(body.nombre),
      descripcion: (body.descripcion as string) ?? null,
      precio: precio ?? 0,
      activoCatalogo: body.activoCatalogo !== false,
      alergenos: (body.alergenos as string) ?? null,
      orden: (body.orden as number) ?? 0,
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

    return {
      producto,
      receta: await getReceta(producto.id),
      costoTeorico: await costoTeoricoProducto(producto.id),
    };
  }
}
