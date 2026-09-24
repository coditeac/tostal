import bcrypt from "bcryptjs";
import { sqlAll, sqlGet, sqlRun } from "./db";
import { ensureSeed } from "./seed";
import { id } from "./id";
import type { SessionUser } from "./auth";

export type StaffUser = SessionUser & {
  activo: boolean;
  creadoEn: string;
};

async function boot() {
  await ensureSeed();
}

export async function listStaff(): Promise<StaffUser[]> {
  await boot();
  const rows = await sqlAll<{
    id: string;
    email: string;
    nombre: string;
    rol: SessionUser["rol"];
    activo: number;
    creado_en: string;
  }>(
    `SELECT id, email, nombre, rol, activo, creado_en FROM usuarios ORDER BY creado_en ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    nombre: r.nombre,
    rol: r.rol,
    activo: !!r.activo,
    creadoEn: r.creado_en,
  }));
}

export async function createStaff(input: {
  email: string;
  nombre: string;
  password: string;
  rol: SessionUser["rol"];
}): Promise<{ ok: true; user: StaffUser } | { ok: false; error: string }> {
  await boot();
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "Email inválido." };
  if (!input.nombre.trim()) return { ok: false, error: "Nombre obligatorio." };
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "Contraseña mínimo 6 caracteres." };
  }
  const roles: SessionUser["rol"][] = ["admin", "cocina", "caja"];
  if (!roles.includes(input.rol)) {
    return { ok: false, error: "Rol no válido (admin|cocina|caja)." };
  }
  const exists = await sqlGet(`SELECT id FROM usuarios WHERE email = ?`, email);
  if (exists) return { ok: false, error: "Ya existe un usuario con ese email." };

  const now = new Date().toISOString();
  const userId = id();
  const hash = await bcrypt.hash(input.password, 10);
  await sqlRun(
    `INSERT INTO usuarios (id, email, nombre, rol, password_hash, activo, creado_en)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    userId,
    email,
    input.nombre.trim(),
    input.rol,
    hash,
    now
  );
  return {
    ok: true,
    user: {
      id: userId,
      email,
      nombre: input.nombre.trim(),
      rol: input.rol,
      activo: true,
      creadoEn: now,
    },
  };
}

export async function updateStaff(
  userId: string,
  data: {
    nombre?: string;
    rol?: SessionUser["rol"];
    activo?: boolean;
    password?: string;
  }
): Promise<{ ok: true; user: StaffUser } | { ok: false; error: string }> {
  await boot();
  const row = await sqlGet<{
    id: string;
    email: string;
    nombre: string;
    rol: SessionUser["rol"];
    activo: number;
    creado_en: string;
  }>(
    `SELECT id, email, nombre, rol, activo, creado_en FROM usuarios WHERE id = ?`,
    userId
  );
  if (!row) return { ok: false, error: "Usuario no encontrado." };

  const nombre = data.nombre?.trim() || row.nombre;
  const rol = data.rol || row.rol;
  const activo = data.activo !== undefined ? (data.activo ? 1 : 0) : row.activo;

  if (data.password) {
    if (data.password.length < 6) {
      return { ok: false, error: "Contraseña mínimo 6 caracteres." };
    }
    const hash = await bcrypt.hash(data.password, 10);
    await sqlRun(
      `UPDATE usuarios SET nombre = ?, rol = ?, activo = ?, password_hash = ? WHERE id = ?`,
      nombre,
      rol,
      activo,
      hash,
      userId
    );
  } else {
    await sqlRun(
      `UPDATE usuarios SET nombre = ?, rol = ?, activo = ? WHERE id = ?`,
      nombre,
      rol,
      activo,
      userId
    );
  }

  return {
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      nombre,
      rol,
      activo: !!activo,
      creadoEn: row.creado_en,
    },
  };
}
