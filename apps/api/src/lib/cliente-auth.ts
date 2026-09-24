import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { sqlAll, sqlGet, sqlRun } from "./db";
import { ensureSeed } from "./seed";
import { id } from "./id";
import { getConfigMap } from "./config";

export const CLIENTE_COOKIE = "tostal_cliente_session";
const SECRET = new TextEncoder().encode(
  process.env.TOSTAL_AUTH_SECRET || "tostal-dev-secret-cambia-en-prod"
);

export type ClienteSession = {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
};

async function boot() {
  await ensureSeed();
}

export async function getCheckoutPolicy(): Promise<{
  requiereCuenta: boolean;
  recomiendaCuenta: boolean;
}> {
  const c = await getConfigMap();
  return {
    // default: no obliga cuenta; guest+email OK
    requiereCuenta: c.checkout_requiere_cuenta === "1",
    recomiendaCuenta: c.checkout_recomienda_cuenta !== "0",
  };
}

export async function registerCliente(input: {
  email: string;
  password: string;
  nombre: string;
  telefono?: string | null;
}): Promise<
  { ok: true; cliente: ClienteSession } | { ok: false; error: string }
> {
  await boot();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Email inválido." };
  }
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (!input.nombre?.trim()) {
    return { ok: false, error: "El nombre es obligatorio." };
  }
  const exists = await sqlGet<{ id: string }>(
    `SELECT id FROM cuentas_cliente WHERE email = ?`,
    email
  );
  if (exists) {
    return { ok: false, error: "Ya existe una cuenta con ese email." };
  }
  const now = new Date().toISOString();
  const cuentaId = id();
  const hash = await bcrypt.hash(input.password, 10);
  await sqlRun(
    `INSERT INTO cuentas_cliente (id, email, password_hash, nombre, telefono, activo, creado_en)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    cuentaId,
    email,
    hash,
    input.nombre.trim(),
    input.telefono?.trim() || null,
    now
  );
  return {
    ok: true,
    cliente: {
      id: cuentaId,
      email,
      nombre: input.nombre.trim(),
      telefono: input.telefono?.trim() || null,
    },
  };
}

export async function loginCliente(
  email: string,
  password: string
): Promise<ClienteSession | null> {
  await boot();
  const row = await sqlGet<{
    id: string;
    email: string;
    nombre: string;
    telefono: string | null;
    password_hash: string;
    activo: number;
  }>(
    `SELECT id, email, nombre, telefono, password_hash, activo FROM cuentas_cliente WHERE email = ?`,
    email.trim().toLowerCase()
  );
  if (!row || !row.activo) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    telefono: row.telefono,
  };
}

export async function signClienteToken(user: ClienteSession): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    nombre: user.nombre,
    telefono: user.telefono,
    kind: "cliente",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export function clienteCookieOptions() {
  const domain = process.env.TOSTAL_COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    ...(domain ? { domain } : {}),
  };
}

export function setClienteCookie(res: Response, token: string) {
  res.cookie(CLIENTE_COOKIE, token, clienteCookieOptions());
}

export function clearClienteCookie(res: Response) {
  const domain = process.env.TOSTAL_COOKIE_DOMAIN || undefined;
  res.clearCookie(CLIENTE_COOKIE, {
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

export async function getClienteFromRequest(
  req: Request
): Promise<ClienteSession | null> {
  await boot();
  const token =
    (req.cookies?.[CLIENTE_COOKIE] as string | undefined) ||
    (typeof req.headers.authorization === "string" &&
    req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.kind && payload.kind !== "cliente") return null;
    return {
      id: String(payload.sub),
      email: String(payload.email),
      nombre: String(payload.nombre),
      telefono: payload.telefono ? String(payload.telefono) : null,
    };
  } catch {
    return null;
  }
}

export async function updateClientePerfil(
  cuentaId: string,
  data: { nombre?: string; telefono?: string | null }
): Promise<ClienteSession | null> {
  const row = await sqlGet<{
    id: string;
    email: string;
    nombre: string;
    telefono: string | null;
  }>(`SELECT id, email, nombre, telefono FROM cuentas_cliente WHERE id = ?`, cuentaId);
  if (!row) return null;
  const nombre = data.nombre?.trim() || row.nombre;
  const telefono =
    data.telefono !== undefined ? data.telefono?.trim() || null : row.telefono;
  await sqlRun(
    `UPDATE cuentas_cliente SET nombre = ?, telefono = ? WHERE id = ?`,
    nombre,
    telefono,
    cuentaId
  );
  return { id: row.id, email: row.email, nombre, telefono };
}

export async function listPedidosCuenta(cuentaId: string) {
  return sqlAll(
    `SELECT id, codigo, canal, estado, estado_pago as "estadoPago",
            metodo_pago as "metodoPago", modo_entrega as "modoEntrega",
            fecha_entrega as "fechaEntrega", cliente_nombre as "clienteNombre",
            cliente_telefono as "clienteTelefono", subtotal, costo_envio as "costoEnvio",
            total, notas, creado_en as "creadoEn"
     FROM pedidos
     WHERE cuenta_cliente_id = ?
     ORDER BY creado_en DESC
     LIMIT 50`,
    cuentaId
  );
}

export async function getClienteEmailForPedido(
  pedidoId: string
): Promise<string | null> {
  const row = await sqlGet<{ email: string | null; guest: string | null }>(
    `SELECT c.email as email, p.cliente_email as guest
     FROM pedidos p
     LEFT JOIN cuentas_cliente c ON c.id = p.cuenta_cliente_id
     WHERE p.id = ?`,
    pedidoId
  );
  return row?.email || row?.guest || null;
}
