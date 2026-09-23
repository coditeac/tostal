import { NextRequest, NextResponse } from "next/server";

const ALLOWED = (
  process.env.TOSTAL_CORS_ORIGINS ||
  "http://127.0.0.1:4322,http://localhost:4322"
).split(",");

export function withCors(res: NextResponse, req?: NextRequest) {
  const origin = req?.headers.get("origin") || "";
  if (origin && ALLOWED.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.headers.set("Access-Control-Allow-Origin", "*");
  } else {
    // Dev fallback: allow localhost variants
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
