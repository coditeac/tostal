import { NextRequest } from "next/server";
import { login, createSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { ensureSeed } from "@/lib/seed";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return jsonError("Email y contraseña son obligatorios.", req, 400);
  }
  const user = await login(String(body.email), String(body.password));
  if (!user) {
    return jsonError("Credenciales incorrectas.", req, 401);
  }
  await createSession(user);
  return jsonOk({ user }, req);
}
