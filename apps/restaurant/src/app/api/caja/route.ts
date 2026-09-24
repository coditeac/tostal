import { NextRequest } from "next/server";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import {
  abrirTurno,
  ajustarVitrina,
  cerrarTurno,
  crearPedidoMostrador,
  entregarPorFicha,
  getTurnoAbierto,
  listPedidosMostradorActivos,
  listVitrina,
} from "@/lib/caja";
import { listProductos } from "@/lib/catalogo";
import { getConfigPublica } from "@/lib/config";
import type { MetodoPago } from "../../../../../../shared/types";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const config = await getConfigPublica();
  return jsonOk(
    {
      turno: await getTurnoAbierto(),
      cola: await listPedidosMostradorActivos(),
      vitrina: await listVitrina(),
      productos: (await listProductos()).filter((p) => p.activoCatalogo),
      canalMostradorActivo: config.canalMostradorActivo,
    },
    req
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["admin", "caja"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.accion) return jsonError("Falta acción.", req);

  if (body.accion === "abrir_turno") {
    return jsonOk({ turno: await abrirTurno(auth.id) }, req);
  }
  if (body.accion === "cerrar_turno") {
    const turno = await cerrarTurno(body.notas);
    if (!turno) return jsonError("No hay turno abierto.", req);
    return jsonOk({ turno }, req);
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
      return jsonError("Método de pago no válido.", req);
    }
    const result = await crearPedidoMostrador({
      clienteNombre: body.clienteNombre,
      clienteTelefono: body.clienteTelefono,
      metodoPago: metodo,
      lineas: body.lineas || [],
      notas: body.notas,
      usuarioId: auth.id,
    });
    if (!result.ok) return jsonError(result.error, req);
    return jsonOk(
      {
        pedido: result.pedido,
        fichaCodigo: result.pedido.fichaCodigo,
        cola: await listPedidosMostradorActivos(),
        vitrina: await listVitrina(),
        turno: await getTurnoAbierto(),
      },
      req,
      201
    );
  }
  if (body.accion === "entregar") {
    if (!body.fichaCodigo) return jsonError("Indica el código de ficha.", req);
    const result = await entregarPorFicha(String(body.fichaCodigo));
    if (!result.ok) return jsonError(result.error, req);
    return jsonOk(
      { pedido: result.pedido, cola: await listPedidosMostradorActivos() },
      req
    );
  }
  if (body.accion === "vitrina") {
    const result = await ajustarVitrina({
      productoId: body.productoId,
      cantidad: Number(body.cantidad),
      tipo: body.tipo || "entrada",
      motivo: body.motivo || null,
    });
    if (!result.ok) return jsonError(result.error, req);
    return jsonOk({ vitrina: await listVitrina() }, req);
  }
  return jsonError("Acción no reconocida.", req);
}
