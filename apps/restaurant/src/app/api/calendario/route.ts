import { NextRequest } from "next/server";
import {
  getDisponibilidad,
  getDia,
  listDias,
  setDisponibilidad,
  upsertDia,
  copiarDisponibilidad,
} from "@/lib/catalogo";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { hoyISO, sumarDias } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const fecha = req.nextUrl.searchParams.get("fecha");
  if (fecha) {
    return jsonOk(
      {
        dia: getDia(fecha),
        disponibilidad: getDisponibilidad(fecha),
      },
      req
    );
  }
  const from = req.nextUrl.searchParams.get("from") || hoyISO();
  const to = req.nextUrl.searchParams.get("to") || sumarDias(from, 13);
  return jsonOk({ dias: listDias(from, to) }, req);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.fecha) return jsonError("Falta fecha.", req);

  if (body.copiarDesde) {
    const disponibilidad = copiarDisponibilidad(
      String(body.copiarDesde),
      String(body.fecha)
    );
    return jsonOk({ disponibilidad }, req);
  }

  let dia = getDia(body.fecha);
  if (
    body.abierto != null ||
    body.deadlinePedido ||
    body.cupoMaximo !== undefined ||
    body.notas !== undefined
  ) {
    dia = upsertDia({
      fecha: body.fecha,
      abierto: body.abierto ?? dia?.abierto ?? true,
      deadlinePedido:
        body.deadlinePedido ||
        dia?.deadlinePedido ||
        `${body.fecha}T18:00:00.000Z`,
      cupoMaximo:
        body.cupoMaximo !== undefined
          ? body.cupoMaximo
          : (dia?.cupoMaximo ?? 20),
      notas: body.notas !== undefined ? body.notas : (dia?.notas ?? null),
    });
  }

  let disponibilidad = getDisponibilidad(body.fecha);
  if (Array.isArray(body.disponibilidad)) {
    disponibilidad = setDisponibilidad(body.fecha, body.disponibilidad);
  }

  return jsonOk({ dia, disponibilidad }, req);
}
