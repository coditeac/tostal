import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import {
  actualizarItemLista,
  actualizarLineaCarrito,
  calcularSugerencia,
  crearCarritoDesdeLista,
  crearCarritoManual,
  crearListaDesdeSugerencia,
  getCarrito,
  getLista,
  listCarritos,
  listListas,
  marcarCarritoComprado,
} from "../../lib/compras";
import { aCentavos } from "../../lib/utils";

@Controller("compras")
export class ComprasController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("listaId") listaId?: string,
    @Query("carritoId") carritoId?: string
  ) {
    await requireUser(req);
    if (listaId) {
      const lista = await getLista(listaId);
      if (!lista) throw new NotFoundException("Lista no encontrada.");
      return { lista };
    }
    if (carritoId) {
      const carrito = await getCarrito(carritoId);
      if (!carrito) throw new NotFoundException("Carrito no encontrado.");
      return { carrito };
    }
    return {
      sugerencia: await calcularSugerencia(),
      listas: await listListas(),
      carritos: await listCarritos(),
    };
  }

  @Post()
  @HttpCode(201)
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const auth = await requireUser(req, ["admin"]);
    if (!body?.accion) throw new BadRequestException("Falta acción.");

    try {
      if (body.accion === "crear_lista") {
        const lista = await crearListaDesdeSugerencia(
          body.items as Parameters<typeof crearListaDesdeSugerencia>[0],
          body.notas as string | undefined
        );
        return { lista };
      }
      if (body.accion === "crear_carrito_desde_lista") {
        if (!body.listaId) throw new BadRequestException("Falta listaId.");
        const carrito = await crearCarritoDesdeLista(
          String(body.listaId),
          body.proveedor as string | undefined
        );
        return { carrito };
      }
      if (body.accion === "crear_carrito") {
        if (!Array.isArray(body.lineas) || !body.lineas.length) {
          throw new BadRequestException("Agrega líneas al carrito.");
        }
        const carrito = await crearCarritoManual(
          (
            body.lineas as Array<{
              insumoId: string;
              cantidad: number;
              costoPesos?: number;
              costoUnitario?: number;
            }>
          ).map((l) => ({
            insumoId: l.insumoId,
            cantidad: Number(l.cantidad),
            costoUnitario:
              l.costoUnitario ??
              (l.costoPesos != null
                ? aCentavos(Number(l.costoPesos))
                : undefined),
          })),
          body.proveedor as string | undefined
        );
        return { carrito };
      }
      if (body.accion === "marcar_comprada") {
        if (!body.carritoId) throw new BadRequestException("Falta carritoId.");
        const result = await marcarCarritoComprado(String(body.carritoId), {
          lineasCompradas: body.lineasCompradas as string[] | undefined,
          registrarGasto: body.registrarGasto !== false,
          usuarioId: auth.id,
        });
        if (!result.ok) throw new BadRequestException(result.error);
        return { carrito: result.carrito };
      }
      throw new BadRequestException("Acción no reconocida.");
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        e instanceof Error ? e.message : "Error"
      );
    }
  }

  @Patch()
  async patch(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body) throw new BadRequestException("Cuerpo inválido.");

    if (body.itemListaId && body.cantidad != null) {
      await actualizarItemLista(
        String(body.itemListaId),
        Number(body.cantidad),
        body.proveedor as string | undefined
      );
      return { ok: true };
    }
    if (body.lineaCarritoId) {
      const carrito = await actualizarLineaCarrito(String(body.lineaCarritoId), {
        cantidad: body.cantidad != null ? Number(body.cantidad) : undefined,
        costoUnitario:
          body.costoUnitario != null
            ? Number(body.costoUnitario)
            : body.costoPesos != null
              ? aCentavos(Number(body.costoPesos))
              : undefined,
      });
      return { carrito };
    }
    throw new BadRequestException("Nada que actualizar.");
  }
}
