import { NextRequest } from "next/server";
import { listInsumos, upsertInsumo } from "@/lib/catalogo";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { aCentavos } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const insumos = (await listInsumos()).map((i) => ({
    ...i,
    bajoMinimo: i.stockActual <= i.stockMinimo,
  }));
  return jsonOk({ insumos }, req);
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.nombre || !body?.unidad) {
    return jsonError("Nombre y unidad son obligatorios.", req);
  }
  const costo =
    typeof body.costoUnitario === "number" && body.costoUnitario > 50
      ? Math.round(body.costoUnitario)
      : aCentavos(Number(body.costoPesos ?? body.costoUnitario ?? 0));

  const insumo = await upsertInsumo({
    nombre: String(body.nombre),
    unidad: body.unidad,
    stockActual: Number(body.stockActual ?? 0),
    stockMinimo: Number(body.stockMinimo ?? 0),
    costoUnitario: costo,
    ubicacion: body.ubicacion || null,
    proveedorPreferido: body.proveedorPreferido || null,
  });
  return jsonOk({ insumo }, req, 201);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.id) return jsonError("Falta id.", req);
  const costo =
    typeof body.costoUnitario === "number"
      ? body.costoUnitario > 50
        ? Math.round(body.costoUnitario)
        : aCentavos(body.costoUnitario)
      : aCentavos(Number(body.costoPesos ?? 0));

  const insumo = await upsertInsumo({
    id: body.id,
    nombre: String(body.nombre),
    unidad: body.unidad,
    stockActual: Number(body.stockActual ?? 0),
    stockMinimo: Number(body.stockMinimo ?? 0),
    costoUnitario: costo,
    ubicacion: body.ubicacion || null,
    proveedorPreferido: body.proveedorPreferido || null,
  });
  return jsonOk({ insumo }, req);
}
