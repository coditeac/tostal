import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  getMenuDiaStaff,
  listDias,
  programarMenuDia,
} from "../../lib/catalogo";
import { requireUser } from "../../common/session.decorator";
import { hoyISO, sumarDias } from "../../lib/utils";

/**
 * Menú del día (staff). Contrato:
 * GET|PUT /api/menu-dia/:fecha
 * POST /api/menu-dia/:fecha/programar
 *
 * Alias legado /api/calendario y /api/menu-diario se mantienen en CalendarioController.
 */
@Controller("menu-dia")
export class MenuDiaController {
  @Get()
  async list(
    @Req() req: Request,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string
  ) {
    await requireUser(req);
    const from = fromParam || hoyISO();
    const to = toParam || sumarDias(from, 7);
    return {
      dias: await listDias(from, to),
      hoy: hoyISO(),
      manana: sumarDias(hoyISO(), 1),
    };
  }

  @Get(":fecha")
  async getOne(@Req() req: Request, @Param("fecha") fecha: string) {
    await requireUser(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException("Fecha inválida (YYYY-MM-DD).");
    }
    return getMenuDiaStaff(fecha);
  }

  @Put(":fecha")
  async put(
    @Req() req: Request,
    @Param("fecha") fecha: string,
    @Body() body: Record<string, unknown>
  ) {
    await requireUser(req, ["admin"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException("Fecha inválida (YYYY-MM-DD).");
    }
    return programarMenuDia({
      fecha,
      abierto: body.abierto as boolean | undefined,
      horaLimite: (body.hora_limite as string) || (body.horaLimite as string) || null,
      deadlinePedido: (body.deadlinePedido as string) || null,
      cupoMaximo:
        body.cupoMaximo !== undefined
          ? (body.cupoMaximo as number | null)
          : undefined,
      notas: body.notas !== undefined ? (body.notas as string | null) : undefined,
      productos: normalizeProductosBody(body),
      copiarDesde: (body.copiarDesde as string) || null,
    });
  }

  @Post(":fecha/programar")
  async programar(
    @Req() req: Request,
    @Param("fecha") fecha: string,
    @Body() body: Record<string, unknown>
  ) {
    await requireUser(req, ["admin"]);
    const target =
      fecha === "manana" || fecha === "mañana"
        ? sumarDias(hoyISO(), 1)
        : fecha;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
      throw new BadRequestException("Fecha inválida (YYYY-MM-DD o 'manana').");
    }
    return programarMenuDia({
      fecha: target,
      abierto: body.abierto !== false,
      horaLimite: (body.hora_limite as string) || (body.horaLimite as string) || null,
      deadlinePedido: (body.deadlinePedido as string) || null,
      cupoMaximo:
        body.cupoMaximo !== undefined
          ? (body.cupoMaximo as number | null)
          : 20,
      notas: (body.notas as string) || null,
      productos: normalizeProductosBody(body),
      copiarDesde:
        (body.copiarDesde as string) ||
        (body.copiar_hoy ? hoyISO() : null),
    });
  }
}

function normalizeProductosBody(body: Record<string, unknown>) {
  const raw =
    (body.productos as unknown[]) ||
    (body.disponibilidad as unknown[]) ||
    null;
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => {
    const p = item as Record<string, unknown>;
    return {
      productoId: String(p.productoId || p.producto_id || p.id || ""),
      activo:
        p.activo != null
          ? !!p.activo
          : p.disponible != null
            ? !!p.disponible
            : false,
      disponible:
        p.disponible != null
          ? !!p.disponible
          : p.activo != null
            ? !!p.activo
            : false,
    };
  });
}
