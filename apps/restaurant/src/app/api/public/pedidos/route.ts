import { NextRequest } from "next/server";
import { crearPedidoRemoto, getPedido } from "@/lib/pedidos";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { ensureSeed } from "@/lib/seed";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const body = await req.json().catch(() => null);
  if (!body) return jsonError("JSON inválido", req);

  const result = await crearPedidoRemoto({
    fechaEntrega: String(body.fechaEntrega || ""),
    modoEntrega: body.modoEntrega,
    zonaId: body.zonaId || null,
    clienteNombre: String(body.clienteNombre || ""),
    clienteTelefono: String(body.clienteTelefono || ""),
    direccion: body.direccion || null,
    metodoPago: body.metodoPago,
    notas: body.notas || null,
    lineas: Array.isArray(body.lineas) ? body.lineas : [],
  });

  if (!result.ok) return jsonError(result.error, req, 400);
  return jsonOk({ pedido: result.pedido }, req, 201);
}

export async function GET(req: NextRequest) {
  await ensureSeed();
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo) return jsonError("Indica el código del pedido.", req);
  const pedido = await getPedido(codigo);
  if (!pedido) return jsonError("Pedido no encontrado.", req, 404);
  return jsonOk({ pedido }, req);
}
