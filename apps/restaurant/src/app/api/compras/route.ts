import { NextRequest } from "next/server";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
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
} from "@/lib/compras";
import { aCentavos } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const listaId = req.nextUrl.searchParams.get("listaId");
  const carritoId = req.nextUrl.searchParams.get("carritoId");

  if (listaId) {
    const lista = await getLista(listaId);
    if (!lista) return jsonError("Lista no encontrada.", req, 404);
    return jsonOk({ lista }, req);
  }
  if (carritoId) {
    const carrito = await getCarrito(carritoId);
    if (!carrito) return jsonError("Carrito no encontrado.", req, 404);
    return jsonOk({ carrito }, req);
  }

  return jsonOk(
    {
      sugerencia: await calcularSugerencia(),
      listas: await listListas(),
      carritos: await listCarritos(),
    },
    req
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.accion) return jsonError("Falta acción.", req);

  try {
    if (body.accion === "crear_lista") {
      const lista = await crearListaDesdeSugerencia(body.items, body.notas);
      return jsonOk({ lista }, req, 201);
    }
    if (body.accion === "crear_carrito_desde_lista") {
      if (!body.listaId) return jsonError("Falta listaId.", req);
      const carrito = await crearCarritoDesdeLista(
        body.listaId,
        body.proveedor
      );
      return jsonOk({ carrito }, req, 201);
    }
    if (body.accion === "crear_carrito") {
      if (!Array.isArray(body.lineas) || !body.lineas.length) {
        return jsonError("Agrega líneas al carrito.", req);
      }
      const carrito = await crearCarritoManual(
        body.lineas.map(
          (l: {
            insumoId: string;
            cantidad: number;
            costoPesos?: number;
            costoUnitario?: number;
          }) => ({
            insumoId: l.insumoId,
            cantidad: Number(l.cantidad),
            costoUnitario:
              l.costoUnitario ??
              (l.costoPesos != null
                ? aCentavos(Number(l.costoPesos))
                : undefined),
          })
        ),
        body.proveedor
      );
      return jsonOk({ carrito }, req, 201);
    }
    if (body.accion === "marcar_comprada") {
      if (!body.carritoId) return jsonError("Falta carritoId.", req);
      const result = await marcarCarritoComprado(body.carritoId, {
        lineasCompradas: body.lineasCompradas,
        registrarGasto: body.registrarGasto !== false,
        usuarioId: auth.id,
      });
      if (!result.ok) return jsonError(result.error, req);
      return jsonOk({ carrito: result.carrito }, req);
    }
    return jsonError("Acción no reconocida.", req);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", req);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Cuerpo inválido.", req);

  if (body.itemListaId && body.cantidad != null) {
    await actualizarItemLista(
      body.itemListaId,
      Number(body.cantidad),
      body.proveedor
    );
    return jsonOk({ ok: true }, req);
  }
  if (body.lineaCarritoId) {
    const carrito = await actualizarLineaCarrito(body.lineaCarritoId, {
      cantidad: body.cantidad != null ? Number(body.cantidad) : undefined,
      costoUnitario:
        body.costoUnitario != null
          ? Number(body.costoUnitario)
          : body.costoPesos != null
            ? aCentavos(Number(body.costoPesos))
            : undefined,
    });
    return jsonOk({ carrito }, req);
  }
  return jsonError("Nada que actualizar.", req);
}
