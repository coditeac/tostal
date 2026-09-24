import { NextRequest } from "next/server";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import {
  alertasStock,
  listMovimientos,
  registrarMovimiento,
} from "@/lib/inventario";
import { listInsumos } from "@/lib/catalogo";
import type { TipoMovimiento } from "../../../../../../shared/types";
import { aCentavos } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const insumoId = req.nextUrl.searchParams.get("insumoId") || undefined;
  const vista = req.nextUrl.searchParams.get("vista") || "todo";

  if (vista === "alertas") {
    return jsonOk({ alertas: await alertasStock() }, req);
  }

  return jsonOk(
    {
      insumos: (await listInsumos()).map((i) => ({
        ...i,
        bajoMinimo: i.stockActual <= i.stockMinimo,
      })),
      alertas: await alertasStock(),
      movimientos: await listMovimientos({ insumoId, limit: 60 }),
    },
    req
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["admin", "cocina"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.insumoId || !body?.tipo || body.cantidad == null) {
    return jsonError("Faltan insumo, tipo o cantidad.", req);
  }

  const tipos: TipoMovimiento[] = [
    "entrada",
    "salida",
    "ajuste",
    "merma",
    "produccion",
  ];
  if (!tipos.includes(body.tipo)) {
    return jsonError("Tipo de movimiento no válido.", req);
  }

  const costo =
    body.costoPesos != null
      ? aCentavos(Number(body.costoPesos))
      : body.costoUnitario != null
        ? Number(body.costoUnitario)
        : null;

  const result = await registrarMovimiento({
    insumoId: body.insumoId,
    tipo: body.tipo,
    cantidad: Number(body.cantidad),
    motivo: body.motivo || null,
    usuarioId: auth.id,
    actualizarCosto: costo,
  });
  if (!result.ok) return jsonError(result.error, req);
  return jsonOk(
    {
      ok: true,
      alertas: await alertasStock(),
      movimientos: await listMovimientos({ limit: 40 }),
    },
    req,
    201
  );
}
