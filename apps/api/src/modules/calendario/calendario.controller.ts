import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  getDisponibilidad,
  getDia,
  listDias,
  copiarDisponibilidad,
  programarMenuDia,
} from "../../lib/catalogo";
import { requireUser } from "../../common/session.decorator";
import { hoyISO, sumarDias } from "../../lib/utils";

/**
 * Alias legado de programación de menú.
 * Preferir /api/menu-dia/:fecha (contrato).
 * Fechas / hora límite en America/Mexico_City.
 */
@Controller(["calendario", "menu-diario"])
export class CalendarioController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("fecha") fecha?: string,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string,
    @Query("manana") manana?: string
  ) {
    await requireUser(req);
    const target =
      manana === "1" || manana === "true"
        ? sumarDias(hoyISO(), 1)
        : fecha;
    if (target) {
      return {
        dia: await getDia(target),
        disponibilidad: await getDisponibilidad(target),
        fecha: target,
        hora_limite: (await getDia(target))?.deadlinePedido ?? null,
        esManana: target === sumarDias(hoyISO(), 1),
        tz: "America/Mexico_City",
      };
    }
    const from = fromParam || hoyISO();
    const to = toParam || sumarDias(from, 7);
    return {
      dias: await listDias(from, to),
      manana: sumarDias(hoyISO(), 1),
      hoy: hoyISO(),
      tz: "America/Mexico_City",
    };
  }

  @Put()
  async put(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.fecha) throw new BadRequestException("Falta fecha.");

    if (body.copiarDesde && !body.disponibilidad && !body.productos) {
      const disponibilidad = await copiarDisponibilidad(
        String(body.copiarDesde),
        String(body.fecha)
      );
      return { disponibilidad };
    }

    return programarMenuDia({
      fecha: String(body.fecha),
      abierto: body.abierto as boolean | undefined,
      horaLimite: (body.hora_limite as string) || (body.horaLimite as string) || null,
      deadlinePedido: (body.deadlinePedido as string) || null,
      cupoMaximo:
        body.cupoMaximo !== undefined
          ? (body.cupoMaximo as number | null)
          : undefined,
      notas: body.notas !== undefined ? (body.notas as string | null) : undefined,
      productos: Array.isArray(body.disponibilidad)
        ? (body.disponibilidad as Array<{ productoId: string; disponible: boolean }>).map(
            (d) => ({
              productoId: d.productoId,
              disponible: d.disponible,
              activo: d.disponible,
            })
          )
        : Array.isArray(body.productos)
          ? (body.productos as Array<{ productoId: string; activo?: boolean }>).map(
              (p) => ({
                productoId: p.productoId,
                activo: p.activo,
                disponible: p.activo,
              })
            )
          : undefined,
      copiarDesde: (body.copiarDesde as string) || null,
    });
  }
}
