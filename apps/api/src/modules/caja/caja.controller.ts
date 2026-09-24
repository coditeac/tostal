import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  BadRequestException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import {
  abrirTurno,
  ajustarVitrina,
  cerrarTurno,
  crearPedidoMostrador,
  entregarPorFicha,
  getTurnoAbierto,
  listPedidosMostradorActivos,
  listVitrina,
} from "../../lib/caja";
import { listProductos } from "../../lib/catalogo";
import { getConfigPublica } from "../../lib/config";
import type { MetodoPago } from "../../../../../shared/types";

@Controller("caja")
export class CajaController {
  @Get()
  async get(@Req() req: Request) {
    await requireUser(req);
    const config = await getConfigPublica();
    return {
      turno: await getTurnoAbierto(),
      cola: await listPedidosMostradorActivos(),
      vitrina: await listVitrina(),
      productos: (await listProductos()).filter((p) => p.activoCatalogo),
      canalMostradorActivo: config.canalMostradorActivo,
    };
  }

  @Post()
  @HttpCode(200)
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const auth = await requireUser(req, ["admin", "caja"]);
    if (!body?.accion) throw new BadRequestException("Falta acción.");

    if (body.accion === "abrir_turno") {
      return { turno: await abrirTurno(auth.id) };
    }
    if (body.accion === "cerrar_turno") {
      const turno = await cerrarTurno(body.notas as string | undefined);
      if (!turno) throw new BadRequestException("No hay turno abierto.");
      return { turno };
    }
    if (body.accion === "crear_pedido") {
      const metodos: MetodoPago[] = [
        "efectivo_mostrador",
        "transferencia",
        "stripe",
        "contra_entrega",
      ];
      const metodo = (body.metodoPago || "efectivo_mostrador") as MetodoPago;
      if (!metodos.includes(metodo)) {
        throw new BadRequestException("Método de pago no válido.");
      }
      const result = await crearPedidoMostrador({
        clienteNombre: body.clienteNombre as string,
        clienteTelefono: body.clienteTelefono as string,
        metodoPago: metodo,
        lineas: (body.lineas as Parameters<typeof crearPedidoMostrador>[0]["lineas"]) || [],
        notas: body.notas as string | undefined,
        usuarioId: auth.id,
      });
      if (!result.ok) throw new BadRequestException(result.error);
      return {
        pedido: result.pedido,
        fichaCodigo: result.pedido.fichaCodigo,
        cola: await listPedidosMostradorActivos(),
        vitrina: await listVitrina(),
        turno: await getTurnoAbierto(),
      };
    }
    if (body.accion === "entregar") {
      if (!body.fichaCodigo) {
        throw new BadRequestException("Indica el código de ficha.");
      }
      const result = await entregarPorFicha(String(body.fichaCodigo));
      if (!result.ok) throw new BadRequestException(result.error);
      return {
        pedido: result.pedido,
        cola: await listPedidosMostradorActivos(),
      };
    }
    if (body.accion === "vitrina") {
      const result = await ajustarVitrina({
        productoId: String(body.productoId),
        cantidad: Number(body.cantidad),
        tipo: (body.tipo as "entrada" | "salida" | "merma" | "set") || "entrada",
        motivo: (body.motivo as string) || null,
      });
      if (!result.ok) throw new BadRequestException(result.error);
      return { vitrina: await listVitrina() };
    }
    throw new BadRequestException("Acción no reconocida.");
  }
}
