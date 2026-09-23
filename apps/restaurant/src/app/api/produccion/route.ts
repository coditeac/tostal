import { NextRequest } from "next/server";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import {
  actualizarEstadoPedido,
  listPedidos,
} from "@/lib/pedidos";
import { enviarAVitrinaDesdePedido } from "@/lib/caja";
import { hoyISO } from "@/lib/utils";
import type { EstadoPedido } from "../../../../../../shared/types";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const fecha = req.nextUrl.searchParams.get("fecha") || hoyISO();
  const pedidos = listPedidos({ fecha }).filter(
    (p) =>
      !["entregado", "cancelado"].includes(p.estado) ||
      p.estado === "listo"
  );
  // Cola: confirmados y en producción primero; recibidos también
  const orden: Record<string, number> = {
    en_produccion: 0,
    confirmado: 1,
    recibido: 2,
    listo: 3,
  };
  pedidos.sort(
    (a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) || a.codigo.localeCompare(b.codigo)
  );
  return jsonOk({ fecha, pedidos }, req);
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["admin", "cocina"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.pedidoId || !body?.accion) {
    return jsonError("Faltan pedidoId o acción.", req);
  }

  const mapa: Record<string, EstadoPedido> = {
    confirmar: "confirmado",
    iniciar: "en_produccion",
    listo: "listo",
    entregar: "entregado",
    cancelar: "cancelado",
  };
  const estado = mapa[body.accion];
  if (!estado) return jsonError("Acción no válida.", req);

  const result = actualizarEstadoPedido(body.pedidoId, estado, auth.id);
  if (!result.ok) return jsonError(result.error, req);

  if (body.accion === "listo" && body.aVitrina) {
    enviarAVitrinaDesdePedido(body.pedidoId);
  }

  return jsonOk({
    pedido: result.pedido,
    descuentoInsumos: body.accion === "iniciar",
  }, req);
}
