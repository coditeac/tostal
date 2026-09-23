import { NextRequest } from "next/server";
import { destroySession, getSession } from "@/lib/auth";
import { jsonOk, optionsCors } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function POST(req: NextRequest) {
  await destroySession();
  return jsonOk({ ok: true }, req);
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  return jsonOk({ user }, req);
}
