import { NextRequest } from "next/server";
import { getConfigPublica, getConfigMap, setConfig } from "@/lib/config";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { getSession, isSessionUser, requireSession } from "@/lib/auth";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (session) {
    return jsonOk({ public: getConfigPublica(), all: getConfigMap() }, req);
  }
  return jsonOk({ public: getConfigPublica() }, req);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Datos inválidos", req);
  }
  const allowed = [
    "marca",
    "eslogan",
    "moneda",
    "canal_remoto_activo",
    "canal_mostrador_activo",
    "telefono_whatsapp",
    "direccion_retiro",
    "plantilla_deadline_horas",
  ];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) setConfig(k, String(v));
  }
  return jsonOk({ public: getConfigPublica(), all: getConfigMap() }, req);
}
