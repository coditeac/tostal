import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  BadRequestException,
  NotFoundException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import { listDias, getMenuPorDia } from "../../lib/catalogo";
import { getConfigPublica } from "../../lib/config";
import { crearPedidoRemoto, getPedido } from "../../lib/pedidos";
import { ensureSeed } from "../../lib/seed";
import { hoyISO, sumarDias } from "../../lib/utils";
import { getClienteFromRequest } from "../../lib/cliente-auth";

@Controller("public")
export class PublicController {
  @Get("dias")
  async dias(
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string
  ) {
    await ensureSeed();
    const from = fromParam || hoyISO();
    const to = toParam || sumarDias(from, 13);
    const dias = (await listDias(from, to)).map((d) => ({
      ...d,
      deadlineVigente: new Date() < new Date(d.deadlinePedido),
    }));
    return { dias, config: await getConfigPublica() };
  }

  @Get("menu")
  async menu(@Query("fecha") fecha?: string) {
    await ensureSeed();
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException(
        "Indica una fecha válida (YYYY-MM-DD)."
      );
    }
    return getMenuPorDia(fecha);
  }

  @Post("pedidos")
  @HttpCode(201)
  async crearPedido(
    @Req() req: Request,
    @Body() body: Record<string, unknown>
  ) {
    await ensureSeed();
    if (!body) throw new BadRequestException("JSON inválido");
    const session = await getClienteFromRequest(req);
    const result = await crearPedidoRemoto({
      fechaEntrega: String(body.fechaEntrega || ""),
      modoEntrega: body.modoEntrega as "retiro" | "envio",
      zonaId: (body.zonaId as string) || null,
      clienteNombre: String(
        body.clienteNombre || session?.nombre || ""
      ),
      clienteTelefono: String(
        body.clienteTelefono || session?.telefono || ""
      ),
      clienteEmail:
        (body.clienteEmail as string) ||
        (body.email as string) ||
        session?.email ||
        null,
      cuentaClienteId: session?.id || null,
      direccion: (body.direccion as string) || null,
      metodoPago: body.metodoPago as
        | "transferencia"
        | "stripe"
        | "contra_entrega"
        | "efectivo_mostrador",
      notas: (body.notas as string) || null,
      lineas: Array.isArray(body.lineas) ? body.lineas : [],
    });
    if (!result.ok) throw new BadRequestException(result.error);
    return { pedido: result.pedido };
  }

  @Get("pedidos")
  async getPedido(@Query("codigo") codigo?: string) {
    await ensureSeed();
    if (!codigo) {
      throw new BadRequestException("Indica el código del pedido.");
    }
    const pedido = await getPedido(codigo);
    if (!pedido) throw new NotFoundException("Pedido no encontrado.");
    return { pedido };
  }
}
