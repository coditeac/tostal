"use client";

import { createClient } from "@/lib/supabase/client";
import type { StaffRol } from "@/lib/roles";

export type StaffUser = {
  id: string;
  email: string;
  nombre: string;
  rol: StaffRol;
  activo: boolean;
};

export async function listStaff(): Promise<StaffUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nombre, rol, activo")
    .in("rol", ["superadmin", "admin", "cocina", "caja"])
    .order("email");
  if (error) throw new Error(error.message);
  return (data || []).map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre || u.email.split("@")[0],
    rol: u.rol as StaffRol,
    activo: u.activo,
  }));
}

export async function updateStaffProfile(input: {
  id: string;
  nombre?: string;
  rol?: StaffRol;
  activo?: boolean;
}) {
  const supabase = createClient();

  if (input.activo === false) {
    const { data: target, error: e0 } = await supabase
      .from("profiles")
      .select("id, rol, activo")
      .eq("id", input.id)
      .single();
    if (e0 || !target) throw new Error(e0?.message || "Usuario no encontrado");
    if (target.rol === "superadmin") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("rol", "superadmin")
        .eq("activo", true);
      if ((count ?? 0) <= 1) {
        throw new Error(
          "No se puede desactivar el único superadmin activo."
        );
      }
    }
  }

  const patch: {
    updated_at: string;
    nombre?: string;
    rol?: StaffRol;
    activo?: boolean;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (input.nombre != null) patch.nombre = input.nombre;
  if (input.rol != null) {
    if (input.rol === "superadmin") {
      throw new Error("No se puede asignar superadmin desde la app.");
    }
    patch.rol = input.rol;
  }
  if (input.activo != null) patch.activo = input.activo;
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

/** Soft-delete staff: `activo=false` (nunca hard-delete Auth). */
export async function deleteStaffUser(id: string): Promise<"soft"> {
  await updateStaffProfile({ id, activo: false });
  return "soft";
}

/**
 * Alta de staff vía API server (service_role).
 * No usa signUp del browser: evita robar sesión admin y escalada por metadata.
 */
export async function createStaffUser(input: {
  email: string;
  nombre: string;
  password: string;
  rol: StaffRol;
}) {
  if (input.rol === "superadmin") {
    throw new Error("No se puede crear superadmin desde la app.");
  }
  const res = await fetch("/api/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      nombre: input.nombre.trim(),
      password: input.password,
      rol: input.rol,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "No se pudo crear el usuario");
  }
  if (!data.id) throw new Error("No se creó el usuario Auth");
  return data.id;
}
