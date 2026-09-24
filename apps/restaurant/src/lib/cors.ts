import { NextRequest, NextResponse } from "next/server";

/**
 * Orígenes permitidos para CORS (App Cliente → API Restaurant).
 * Oficiales: tostal.cafe. Railway queda como fallback temporal.
 */
const DEFAULT_ORIGINS = [
  "https://tostal.cafe",
  "https://www.tostal.cafe",
  "https://tostal.up.railway.app",
  "http://127.0.0.1:4322",
  "http://localhost:4322",
].join(",");

const ALLOWED = (process.env.TOSTAL_CORS_ORIGINS || DEFAULT_ORIGINS)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function withCors(res: NextResponse, req?: NextRequest) {
  const origin = req?.headers.get("origin") || "";
  if (origin && ALLOWED.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.headers.set("Access-Control-Allow-Origin", "*");
  } else if (
    origin.endsWith(".tostal.cafe") ||
    origin.endsWith(".up.railway.app") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1")
  ) {
    // Dev / fallback Railway / subdominios Tostal
    res.headers.set("Access-Control-Allow-Origin", origin);
  } else {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  // SSE / EventSource no envía custom headers; permitir stream cross-origin
  res.headers.set("Access-Control-Expose-Headers", "Content-Type");
  return res;
}

export function jsonOk(data: unknown, req?: NextRequest, status = 200) {
  return withCors(NextResponse.json(data, { status }), req);
}

export function jsonError(error: string, req?: NextRequest, status = 400) {
  return withCors(NextResponse.json({ error }, { status }), req);
}

export function optionsCors(req: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}
