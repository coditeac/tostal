import { NextRequest } from "next/server";
import { getMenuPorDia } from "@/lib/catalogo";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { ensureSeed } from "@/lib/seed";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  ensureSeed();
  const fecha = req.nextUrl.searchParams.get("fecha");
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return jsonError("Indica una fecha válida (YYYY-MM-DD).", req);
  }
  return jsonOk(getMenuPorDia(fecha), req);
}
