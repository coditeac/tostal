import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sqlGet } from "./db";
import { ensureSeed } from "./seed";

const COOKIE = "tostal_session";
const SECRET = new TextEncoder().encode(
  process.env.TOSTAL_AUTH_SECRET || "tostal-dev-secret-cambia-en-prod"
);

export type SessionUser = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "cocina" | "caja";
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

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  await boot();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
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

export async function requireSession(
  roles?: SessionUser["rol"][]
): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (roles && !roles.includes(session.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  return session;
}

export function isSessionUser(
  value: SessionUser | NextResponse
): value is SessionUser {
  return !(value instanceof NextResponse);
}

export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionUser | null> {
  await boot();
  const token = req.cookies.get(COOKIE)?.value;
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
