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
import { listInsumos, upsertInsumo } from "../../lib/catalogo";
import { requireUser } from "../../common/session.decorator";
import { aCentavos } from "../../lib/utils";

@Controller("insumos")
export class InsumosController {
  @Get()
  async list(@Req() req: Request) {
    await requireUser(req);
    const insumos = (await listInsumos()).map((i) => ({
      ...i,
      bajoMinimo: i.stockActual <= i.stockMinimo,
    }));
    return { insumos };
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.nombre || !body?.unidad) {
      throw new BadRequestException("Nombre y unidad son obligatorios.");
    }
    const costo =
      typeof body.costoUnitario === "number" && body.costoUnitario > 50
        ? Math.round(body.costoUnitario)
        : aCentavos(Number(body.costoPesos ?? body.costoUnitario ?? 0));

    const insumo = await upsertInsumo({
      nombre: String(body.nombre),
      unidad: body.unidad as "g" | "ml" | "u",
      stockActual: Number(body.stockActual ?? 0),
      stockMinimo: Number(body.stockMinimo ?? 0),
      costoUnitario: costo,
      ubicacion: (body.ubicacion as string) || null,
      proveedorPreferido: (body.proveedorPreferido as string) || null,
    });
    return { insumo };
  }

  @Put()
  async update(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.id) throw new BadRequestException("Falta id.");
    const costo =
      typeof body.costoUnitario === "number"
        ? body.costoUnitario > 50
          ? Math.round(body.costoUnitario)
          : aCentavos(body.costoUnitario)
        : aCentavos(Number(body.costoPesos ?? 0));

    const insumo = await upsertInsumo({
      id: String(body.id),
      nombre: String(body.nombre),
      unidad: body.unidad as "g" | "ml" | "u",
      stockActual: Number(body.stockActual ?? 0),
      stockMinimo: Number(body.stockMinimo ?? 0),
      costoUnitario: costo,
      ubicacion: (body.ubicacion as string) || null,
      proveedorPreferido: (body.proveedorPreferido as string) || null,
    });
    return { insumo };
  }
}
