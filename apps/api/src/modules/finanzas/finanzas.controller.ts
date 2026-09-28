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
import {
  CATEGORIAS_INGRESO,
  crearIngreso,
  eliminarIngreso,
  listIngresos,
  resumenIngresos,
} from "../../lib/ingresos";
import { aCentavos, hoyISO } from "../../lib/utils";

/**
 * Módulo Finanzas — gastos + ingresos.
 * Alias claros para el panel de 6 módulos.
 * Compat: /api/gastos sigue activo.
 */
@Controller("finanzas")
export class FinanzasController {
  @Get()
  async resumen(
    @Req() req: Request,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string
  ) {
    await requireUser(req);
    const [gastos, ingresos, resumenG, resumenI] = await Promise.all([
      listGastos({ desde, hasta }),
      listIngresos({ desde, hasta }),
      resumenGastos({ desde, hasta }),
      resumenIngresos({ desde, hasta }),
    ]);
    const balance = resumenI.total - resumenG.total;
    return {
      gastos,
      ingresos,
      resumen: {
        desde: resumenG.desde,
        hasta: resumenG.hasta,
        total_gastos: resumenG.total,
        total_ingresos: resumenI.total,
        balance,
        gastos_por_categoria: resumenG.porCategoria,
        ingresos_por_categoria: resumenI.porCategoria,
        ventas_pedidos: resumenI.ventasPedidos,
        anticipos_reservas: resumenI.anticiposReservas,
        // compat camelCase
        totalGastos: resumenG.total,
        totalIngresos: resumenI.total,
        gastosPorCategoria: resumenG.porCategoria,
        ingresosPorCategoria: resumenI.porCategoria,
        ventasPedidos: resumenI.ventasPedidos,
        anticiposReservas: resumenI.anticiposReservas,
      },
      categorias_gasto: CATEGORIAS_GASTO,
      categorias_ingreso: CATEGORIAS_INGRESO,
    };
  }

  @Get("gastos")
  async getGastos(
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

  @Post("gastos")
  @HttpCode(201)
  async postGasto(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.categoria || (body.monto == null && body.montoPesos == null)) {
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

  @Delete("gastos")
  async deleteGasto(@Req() req: Request, @Query("id") idParam?: string) {
    await requireUser(req, ["admin"]);
    if (!idParam) throw new BadRequestException("Falta id.");
    await eliminarGasto(idParam);
    return { ok: true, resumen: await resumenGastos() };
  }

  @Get("ingresos")
  async getIngresos(
    @Req() req: Request,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string,
    @Query("categoria") categoria?: string
  ) {
    await requireUser(req);
    return {
      ingresos: await listIngresos({ desde, hasta, categoria }),
      resumen: await resumenIngresos({ desde, hasta }),
      categorias: CATEGORIAS_INGRESO,
    };
  }

  @Post("ingresos")
  @HttpCode(201)
  async postIngreso(
    @Req() req: Request,
    @Body() body: Record<string, unknown>
  ) {
    await requireUser(req, ["admin"]);
    if (!body?.categoria || (body.monto == null && body.montoPesos == null)) {
      throw new BadRequestException("Categoría y monto son obligatorios.");
    }
    const monto =
      typeof body.monto === "number" && body.monto > 500
        ? Math.round(body.monto)
        : aCentavos(Number(body.montoPesos ?? body.monto));

    const ingreso = await crearIngreso({
      categoria: String(body.categoria),
      monto,
      fecha: (body.fecha as string) || hoyISO(),
      metodoPago: (body.metodoPago as string) || null,
      notas: (body.notas as string) || null,
      pedidoId: (body.pedidoId as string) || (body.pedido_id as string) || null,
      reservaId:
        (body.reservaId as string) || (body.reserva_id as string) || null,
    });
    return { ingreso, resumen: await resumenIngresos() };
  }

  @Delete("ingresos")
  async deleteIngreso(@Req() req: Request, @Query("id") idParam?: string) {
    await requireUser(req, ["admin"]);
    if (!idParam) throw new BadRequestException("Falta id.");
    await eliminarIngreso(idParam);
    return { ok: true, resumen: await resumenIngresos() };
  }
}

/** Alias directo /api/ingresos (además de /api/finanzas/ingresos). */
@Controller("ingresos")
export class IngresosController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string,
    @Query("categoria") categoria?: string
  ) {
    await requireUser(req);
    return {
      ingresos: await listIngresos({ desde, hasta, categoria }),
      resumen: await resumenIngresos({ desde, hasta }),
      categorias: CATEGORIAS_INGRESO,
    };
  }

  @Post()
  @HttpCode(201)
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.categoria || (body.monto == null && body.montoPesos == null)) {
      throw new BadRequestException("Categoría y monto son obligatorios.");
    }
    const monto =
      typeof body.monto === "number" && body.monto > 500
        ? Math.round(body.monto)
        : aCentavos(Number(body.montoPesos ?? body.monto));

    const ingreso = await crearIngreso({
      categoria: String(body.categoria),
      monto,
      fecha: (body.fecha as string) || hoyISO(),
      metodoPago: (body.metodoPago as string) || null,
      notas: (body.notas as string) || null,
      pedidoId: (body.pedidoId as string) || (body.pedido_id as string) || null,
      reservaId:
        (body.reservaId as string) || (body.reserva_id as string) || null,
    });
    return { ingreso, resumen: await resumenIngresos() };
  }

  @Delete()
  async remove(@Req() req: Request, @Query("id") idParam?: string) {
    await requireUser(req, ["admin"]);
    if (!idParam) throw new BadRequestException("Falta id.");
    await eliminarIngreso(idParam);
    return { ok: true, resumen: await resumenIngresos() };
  }
}
