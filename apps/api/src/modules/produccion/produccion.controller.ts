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
import {
  ordenColaEstado,
  type EstadoUnificado,
} from "../../lib/estados";

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
    pedidos.sort(
      (a, b) =>
        ordenColaEstado(a.estado) - ordenColaEstado(b.estado) ||
        a.codigo.localeCompare(b.codigo)
    );
    return { fecha, pedidos };
  }

  @Post()
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const auth = await requireUser(req, ["admin", "cocina", "superadmin"]);
    if (!body?.pedidoId || !body?.accion) {
      throw new BadRequestException("Faltan pedidoId o acción.");
    }
    const mapa: Record<string, EstadoUnificado> = {
      confirmar: "aceptado",
      aceptar: "aceptado",
      iniciar: "preparando",
      preparar: "preparando",
      listo: "listo",
      en_camino: "en_camino",
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
      descuentoInsumos:
        body.accion === "iniciar" || body.accion === "preparar",
    };
  }
}
