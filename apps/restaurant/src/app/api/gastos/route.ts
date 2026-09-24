import { NextRequest } from "next/server";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import {
  CATEGORIAS_GASTO,
  crearGasto,
  eliminarGasto,
  listGastos,
  resumenGastos,
} from "@/lib/gastos";
import { aCentavos, hoyISO } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const desde = req.nextUrl.searchParams.get("desde") || undefined;
  const hasta = req.nextUrl.searchParams.get("hasta") || undefined;
  const categoria = req.nextUrl.searchParams.get("categoria") || undefined;

  return jsonOk(
    {
      gastos: await listGastos({ desde, hasta, categoria }),
      resumen: await resumenGastos({ desde, hasta }),
      categorias: CATEGORIAS_GASTO,
    },
    req
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.categoria || body.monto == null) {
    return jsonError("Categoría y monto son obligatorios.", req);
  }
  const monto =
    typeof body.monto === "number" && body.monto > 500
      ? Math.round(body.monto)
      : aCentavos(Number(body.montoPesos ?? body.monto));

  const gasto = await crearGasto({
    categoria: String(body.categoria),
    monto,
    fecha: body.fecha || hoyISO(),
    metodoPago: body.metodoPago || null,
    notas: body.notas || null,
    comprobante: body.comprobante || null,
  });
  return jsonOk({ gasto, resumen: await resumenGastos() }, req, 201);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return jsonError("Falta id.", req);
  await eliminarGasto(idParam);
  return jsonOk({ ok: true, resumen: await resumenGastos() }, req);
}
