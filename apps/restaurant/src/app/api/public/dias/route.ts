import { NextRequest } from "next/server";
import { listDias } from "@/lib/catalogo";
import { getConfigPublica } from "@/lib/config";
import { jsonOk, optionsCors } from "@/lib/cors";
import { ensureSeed } from "@/lib/seed";
import { hoyISO, sumarDias } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  await ensureSeed();
  const from = req.nextUrl.searchParams.get("from") || hoyISO();
  const to = req.nextUrl.searchParams.get("to") || sumarDias(from, 13);
  const dias = (await listDias(from, to)).map((d) => ({
    ...d,
    deadlineVigente: new Date() < new Date(d.deadlinePedido),
  }));
  return jsonOk({ dias, config: await getConfigPublica() }, req);
}
