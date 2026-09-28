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
  altaRapidaInsumo,
  buscarInsumosAutocomplete,
  calcularSugerencia,
  crearCarritoDesdeLista,
  crearCarritoManual,
  crearListaDesdeSugerencia,
  getCarrito,
  getLista,
  listCarritos,
  listListas,
  listTiendas,
  marcarCarritoComprado,
  upsertTienda,
} from "../../lib/compras";
import { aCentavos } from "../../lib/utils";
import { listGastos } from "../../lib/gastos";

@Controller("compras")
export class ComprasController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("listaId") listaId?: string,
    @Query("carritoId") carritoId?: string,
    @Query("tienda") tienda?: string,
    @Query("vista") vista?: string
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
    if (vista === "tiendas") {
      return { tiendas: await listTiendas() };
    }
    const tiendaCtx = tienda?.trim() || null;
    return {
      tienda: tiendaCtx,
      tiendas: await listTiendas(),
      sugerencia: await calcularSugerencia(7, { tienda: tiendaCtx }),
      listas: await listListas(),
      carritos: await listCarritos(),
    };
  }

  /** Autocomplete de insumos para líneas de compra. */
  @Get("insumos")
  async autocomplete(
    @Req() req: Request,
    @Query("q") q?: string,
    @Query("limit") limit?: string
  ) {
    await requireUser(req);
    const insumos = await buscarInsumosAutocomplete(
      q || "",
      limit ? Number(limit) : 20
    );
    return { insumos };
  }

  @Get("tiendas")
  async tiendas(@Req() req: Request) {
    await requireUser(req);
    return { tiendas: await listTiendas() };
  }

  @Post()
  @HttpCode(201)
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const auth = await requireUser(req, ["admin"]);
    if (!body?.accion) throw new BadRequestException("Falta acción.");

    const tienda =
      (body.tienda as string) ||
      (body.proveedor as string) ||
      undefined;

    try {
      if (body.accion === "set_tienda" || body.accion === "crear_tienda") {
        if (!body.nombre && !tienda) {
          throw new BadRequestException("Indica el nombre de la tienda.");
        }
        const t = await upsertTienda({
          id: body.id ? String(body.id) : undefined,
          nombre: String(body.nombre || tienda),
          notas: (body.notas as string) || null,
          preferido: body.preferido === true,
        });
        return {
          tienda: t,
          sugerencia: await calcularSugerencia(7, { tienda: t.nombre }),
        };
      }
      if (body.accion === "alta_insumo") {
        if (!body?.nombre || !body?.unidad) {
          throw new BadRequestException("Nombre y unidad son obligatorios.");
        }
        const unidad = String(body.unidad) as "g" | "ml" | "u";
        if (!["g", "ml", "u"].includes(unidad)) {
          throw new BadRequestException("Unidad debe ser g, ml o u.");
        }
        const costo =
          typeof body.costoUnitario === "number" && body.costoUnitario > 50
            ? Math.round(body.costoUnitario)
            : aCentavos(Number(body.costoPesos ?? body.costoUnitario ?? 0));
        const { insumo } = await altaRapidaInsumo({
          nombre: String(body.nombre),
          unidad,
          costoUnitario: costo,
          cantidad: body.cantidad != null ? Number(body.cantidad) : 0,
          stockMinimo:
            body.stockMinimo != null ? Number(body.stockMinimo) : 0,
          tienda: tienda || null,
        });
        return { insumo };
      }
      if (body.accion === "crear_lista") {
        const lista = await crearListaDesdeSugerencia(
          body.items as Parameters<typeof crearListaDesdeSugerencia>[0],
          body.notas as string | undefined,
          { tienda: tienda || null }
        );
        return { lista };
      }
      if (body.accion === "crear_carrito_desde_lista") {
        if (!body.listaId) throw new BadRequestException("Falta listaId.");
        const carrito = await crearCarritoDesdeLista(
          String(body.listaId),
          tienda,
          tienda
        );
        return { carrito };
      }
      if (body.accion === "crear_carrito" || body.accion === "iniciar_sesion") {
        if (!Array.isArray(body.lineas) || !body.lineas.length) {
          // Sesión vacía: carrito con sugerencias de la tienda.
          if (body.accion === "iniciar_sesion") {
            const sugerencia = await calcularSugerencia(7, {
              tienda: tienda || null,
            });
            const lineas = sugerencia
              .filter((s) => s.paraTienda)
              .map((s) => ({
                insumoId: s.insumoId,
                cantidad: s.cantidadSugerida,
                costoUnitario: s.costoUnitario,
              }));
            if (!lineas.length) {
              return {
                tienda: tienda || null,
                sugerencia,
                carrito: null,
                mensaje:
                  "No hay recomendaciones para esta tienda. Agrega insumos con autocomplete.",
              };
            }
            const carrito = await crearCarritoManual(lineas, tienda, tienda);
            return { tienda: tienda || null, sugerencia, carrito };
          }
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
          tienda,
          tienda
        );
        return { carrito };
      }
      if (
        body.accion === "marcar_comprada" ||
        body.accion === "cerrar_compra"
      ) {
        if (!body.carritoId) throw new BadRequestException("Falta carritoId.");
        const result = await marcarCarritoComprado(String(body.carritoId), {
          lineasCompradas: body.lineasCompradas as string[] | undefined,
          registrarGasto: body.registrarGasto !== false,
          usuarioId: auth.id,
        });
        if (!result.ok) throw new BadRequestException(result.error);
        const gastos = await listGastos();
        const gastoCreado = gastos.find(
          (g) => g.compraId === String(body.carritoId)
        );
        return {
          carrito: result.carrito,
          gasto: gastoCreado || null,
          gastos_creados: gastoCreado ? [gastoCreado] : [],
        };
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
        (body.proveedor as string) || (body.tienda as string) || undefined
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
