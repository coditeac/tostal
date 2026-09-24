import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  BadRequestException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import {
  CATEGORIAS_GASTO,
  crearGasto,
  eliminarGasto,
  listGastos,
  resumenGastos,
} from "../../lib/gastos";
import { aCentavos, hoyISO } from "../../lib/utils";

@Controller("gastos")
export class GastosController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string,
    @Query("categoria") categoria?: string
  ) {
    await requireUser(req);
    return {
      gastos: await listGastos({ desde, hasta, categoria }),
      resumen: await resumenGastos({ desde, hasta }),
      categorias: CATEGORIAS_GASTO,
    };
  }

  @Post()
  @HttpCode(201)
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.categoria || body.monto == null) {
      throw new BadRequestException("Categoría y monto son obligatorios.");
    }
    const monto =
      typeof body.monto === "number" && body.monto > 500
        ? Math.round(body.monto)
        : aCentavos(Number(body.montoPesos ?? body.monto));

    const gasto = await crearGasto({
      categoria: String(body.categoria),
      monto,
      fecha: (body.fecha as string) || hoyISO(),
      metodoPago: (body.metodoPago as string) || null,
      notas: (body.notas as string) || null,
      comprobante: (body.comprobante as string) || null,
    });
    return { gasto, resumen: await resumenGastos() };
  }

  @Delete()
  async remove(@Req() req: Request, @Query("id") idParam?: string) {
    await requireUser(req, ["admin"]);
    if (!idParam) throw new BadRequestException("Falta id.");
    await eliminarGasto(idParam);
    return { ok: true, resumen: await resumenGastos() };
  }
}
