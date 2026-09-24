import { NextRequest } from "next/server";
import {
  actualizarEstadoPedido,
  listPedidos,
  marcarPago,
} from "@/lib/pedidos";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { hoyISO } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const fecha = req.nextUrl.searchParams.get("fecha") || undefined;
  const canal = req.nextUrl.searchParams.get("canal") || undefined;
  const pedidos = await listPedidos({
    fecha: fecha === "todos" ? undefined : fecha || hoyISO(),
    canal: canal || undefined,
  });
  return jsonOk({ pedidos }, req);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.id) return jsonError("Falta id.", req);

  if (body.estadoPago) {
    const pedido = await marcarPago(body.id, body.estadoPago);
    return jsonOk({ pedido }, req);
  }
  if (body.estado) {
    const result = await actualizarEstadoPedido(body.id, body.estado, auth.id);
    if (!result.ok) return jsonError(result.error, req);
    return jsonOk({ pedido: result.pedido }, req);
  }
  return jsonError("Nada que actualizar.", req);
}
