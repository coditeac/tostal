import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import { actualizarEstadoPedido, listPedidos } from "../../lib/pedidos";
import { enviarAVitrinaDesdePedido } from "../../lib/caja";
import { hoyISO } from "../../lib/utils";
import type { EstadoPedido } from "../../../../../shared/types";

@Controller("produccion")
export class ProduccionController {
  @Get()
  async get(@Req() req: Request, @Query("fecha") fechaParam?: string) {
    await requireUser(req);
    const fecha = fechaParam || hoyISO();
    const pedidos = (await listPedidos({ fecha })).filter(
      (p) =>
        !["entregado", "cancelado"].includes(p.estado) || p.estado === "listo"
    );
    const orden: Record<string, number> = {
      en_produccion: 0,
      confirmado: 1,
      recibido: 2,
      listo: 3,
    };
    pedidos.sort(
      (a, b) =>
        (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) ||
        a.codigo.localeCompare(b.codigo)
    );
    return { fecha, pedidos };
  }

  @Post()
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const auth = await requireUser(req, ["admin", "cocina"]);
    if (!body?.pedidoId || !body?.accion) {
      throw new BadRequestException("Faltan pedidoId o acción.");
    }
    const mapa: Record<string, EstadoPedido> = {
      confirmar: "confirmado",
      iniciar: "en_produccion",
      listo: "listo",
      entregar: "entregado",
      cancelar: "cancelado",
    };
    const estado = mapa[String(body.accion)];
    if (!estado) throw new BadRequestException("Acción no válida.");

    const result = await actualizarEstadoPedido(
      String(body.pedidoId),
      estado,
      auth.id
    );
    if (!result.ok) throw new BadRequestException(result.error);

    if (body.accion === "listo" && body.aVitrina) {
      await enviarAVitrinaDesdePedido(String(body.pedidoId));
    }

    return {
      pedido: result.pedido,
      descuentoInsumos: body.accion === "iniciar",
    };
  }
}
