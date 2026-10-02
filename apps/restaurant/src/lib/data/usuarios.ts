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
  const patch: {
    updated_at: string;
    nombre?: string;
    rol?: StaffRol;
    activo?: boolean;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (input.nombre != null) patch.nombre = input.nombre;
  if (input.rol != null) patch.rol = input.rol;
  if (input.activo != null) patch.activo = input.activo;
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

/**
 * Alta de staff: signup Auth + forzar rol en profiles.
 * Requiere que el actor sea admin/superadmin (RLS).
 * Password reset / invite admin API necesita SUPABASE_SERVICE_ROLE_KEY en server.
 */
export async function createStaffUser(input: {
  email: string;
  nombre: string;
  password: string;
  rol: StaffRol;
}) {
  const supabase = createClient();
  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { nombre: input.nombre, rol: input.rol },
    },
  });
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (!id) throw new Error("No se creó el usuario Auth");

  // Trigger crea profile con rol metadata; reforzamos por si default quedó cliente.
  const { error: e2 } = await supabase
    .from("profiles")
    .update({
      nombre: input.nombre,
      rol: input.rol,
      activo: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (e2) throw new Error(e2.message);
  return id;
}
