import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { sqlGet } from "./db";
import { ensureSeed } from "./seed";
import type { StaffRol } from "./roles";

export const SESSION_COOKIE = "tostal_session";
const SECRET = new TextEncoder().encode(
  process.env.TOSTAL_AUTH_SECRET || "tostal-dev-secret-cambia-en-prod"
);

export type SessionUser = {
  id: string;
  email: string;
  nombre: string;
  rol: StaffRol;
};

async function boot() {
  await ensureSeed();
}

export async function login(
  email: string,
  password: string
): Promise<SessionUser | null> {
  await boot();
  const user = await sqlGet<{
    id: string;
    email: string;
    nombre: string;
    rol: SessionUser["rol"];
    password_hash: string;
    activo: number;
  }>(
    `SELECT id, email, nombre, rol, password_hash, activo FROM usuarios WHERE email = ?`,
    email.trim().toLowerCase()
  );
  if (!user || !user.activo) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
  };
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

/** Express `maxAge` is milliseconds (not seconds). */
const STAFF_COOKIE_MS = 60 * 60 * 24 * 7 * 1000;

function cookieSecure(): boolean {
  // Railway often omits NODE_ENV at runtime; Domain=.tostal.cafe ⇒ HTTPS only.
  if (process.env.TOSTAL_COOKIE_SECURE === "0") return false;
  if (process.env.TOSTAL_COOKIE_SECURE === "1") return true;
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.TOSTAL_COOKIE_DOMAIN)
  );
}

export function cookieOptions() {
  const domain = process.env.TOSTAL_COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: cookieSecure(),
    maxAge: STAFF_COOKIE_MS,
    ...(domain ? { domain } : {}),
  };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: Response) {
  const opts = cookieOptions();
  res.clearCookie(SESSION_COOKIE, {
    path: opts.path,
    sameSite: opts.sameSite,
    secure: opts.secure,
    ...(opts.domain ? { domain: opts.domain } : {}),
  });
}

export async function getSessionFromRequest(
  req: Request
): Promise<SessionUser | null> {
  await boot();
  const token =
    (req.cookies?.[SESSION_COOKIE] as string | undefined) ||
    (typeof req.headers.authorization === "string" &&
    req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: String(payload.sub),
      email: String(payload.email),
      nombre: String(payload.nombre),
      rol: payload.rol as SessionUser["rol"],
    };
  } catch {
    return null;
  }
}
