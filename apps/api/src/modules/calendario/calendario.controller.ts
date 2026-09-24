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
  setDisponibilidad,
  upsertDia,
  copiarDisponibilidad,
} from "../../lib/catalogo";
import { requireUser } from "../../common/session.decorator";
import { hoyISO, sumarDias } from "../../lib/utils";

@Controller("calendario")
export class CalendarioController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("fecha") fecha?: string,
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string
  ) {
    await requireUser(req);
    if (fecha) {
      return {
        dia: await getDia(fecha),
        disponibilidad: await getDisponibilidad(fecha),
      };
    }
    const from = fromParam || hoyISO();
    const to = toParam || sumarDias(from, 13);
    return { dias: await listDias(from, to) };
  }

  @Put()
  async put(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.fecha) throw new BadRequestException("Falta fecha.");

    if (body.copiarDesde) {
      const disponibilidad = await copiarDisponibilidad(
        String(body.copiarDesde),
        String(body.fecha)
      );
      return { disponibilidad };
    }

    let dia = await getDia(String(body.fecha));
    if (
      body.abierto != null ||
      body.deadlinePedido ||
      body.cupoMaximo !== undefined ||
      body.notas !== undefined
    ) {
      dia = await upsertDia({
        fecha: String(body.fecha),
        abierto: (body.abierto as boolean) ?? dia?.abierto ?? true,
        deadlinePedido:
          (body.deadlinePedido as string) ||
          dia?.deadlinePedido ||
          `${body.fecha}T18:00:00.000Z`,
        cupoMaximo:
          body.cupoMaximo !== undefined
            ? (body.cupoMaximo as number | null)
            : (dia?.cupoMaximo ?? 20),
        notas:
          body.notas !== undefined
            ? (body.notas as string | null)
            : (dia?.notas ?? null),
      });
    }

    let disponibilidad = await getDisponibilidad(String(body.fecha));
    if (Array.isArray(body.disponibilidad)) {
      disponibilidad = await setDisponibilidad(
        String(body.fecha),
        body.disponibilidad as Array<{ productoId: string; disponible: boolean }>
      );
    }

    return { dia, disponibilidad };
  }
}
