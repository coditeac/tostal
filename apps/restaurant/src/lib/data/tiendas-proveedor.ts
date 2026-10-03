"use client";

import { createClient } from "@/lib/supabase/client";

export type TiendaProveedorRow = {
  id: string;
  nombre: string;
  contacto: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export async function listTiendasProveedor(opts?: {
  /** Default: only active. Pass `false` to include inactive. */
  soloActivas?: boolean;
}): Promise<TiendaProveedorRow[]> {
  const supabase = createClient();
  let q = supabase
    .from("tiendas_proveedor")
    .select("*")
    .order("nombre", { ascending: true });
  if (opts?.soloActivas !== false) {
    q = q.eq("activo", true);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((t) => ({
    ...t,
    activo: !!t.activo,
  })) as TiendaProveedorRow[];
}

export async function createTiendaProveedor(input: {
  nombre: string;
  contacto?: string | null;
  notas?: string | null;
  activo?: boolean;
}): Promise<TiendaProveedorRow> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la tienda es obligatorio.");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tiendas_proveedor")
    .insert({
      nombre,
      contacto: input.contacto?.trim() || null,
      notas: input.notas?.trim() || null,
      activo: input.activo ?? true,
    })
    .select("*")
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("Ya existe una tienda con ese nombre.");
    }
    throw new Error(error.message);
  }
  return { ...data, activo: !!data.activo } as TiendaProveedorRow;
}

export async function updateTiendaProveedor(input: {
  id: string;
  nombre?: string;
  contacto?: string | null;
  notas?: string | null;
  activo?: boolean;
}): Promise<TiendaProveedorRow> {
  const patch: {
    updated_at: string;
    nombre?: string;
    contacto?: string | null;
    notas?: string | null;
    activo?: boolean;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (input.nombre !== undefined) {
    const nombre = input.nombre.trim();
    if (!nombre) throw new Error("El nombre de la tienda es obligatorio.");
    patch.nombre = nombre;
  }
  if (input.contacto !== undefined) {
    patch.contacto = input.contacto?.trim() || null;
  }
  if (input.notas !== undefined) {
    patch.notas = input.notas?.trim() || null;
  }
  if (input.activo !== undefined) patch.activo = input.activo;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tiendas_proveedor")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("Ya existe una tienda con ese nombre.");
    }
    throw new Error(error.message);
  }
  return { ...data, activo: !!data.activo } as TiendaProveedorRow;
}

/**
 * Soft-delete preferido: desactiva. Hard delete si no hay FKs.
 */
export async function deleteTiendaProveedor(
  id: string
): Promise<"hard" | "soft"> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tiendas_proveedor")
    .delete()
    .eq("id", id);
  if (!error) return "hard";
  if (/foreign key|violates/i.test(error.message)) {
    await updateTiendaProveedor({ id, activo: false });
    return "soft";
  }
  throw new Error(error.message);
}
