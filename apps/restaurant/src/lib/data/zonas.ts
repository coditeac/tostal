"use client";

import { createClient } from "@/lib/supabase/client";

export type ZonaEnvioRow = {
  id: string;
  nombre: string;
  cobertura: string | null;
  costo_envio: number;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
};

export async function listZonas(): Promise<ZonaEnvioRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("zonas_envio")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((z) => ({
    ...z,
    costo_envio: Number(z.costo_envio) || 0,
    activa: !!z.activa,
    orden: Number(z.orden) || 0,
  })) as ZonaEnvioRow[];
}

export async function createZona(input: {
  nombre: string;
  cobertura?: string | null;
  /** Costo en pesos MXN (UI). Se guarda en centavos. */
  costoPesos: number;
  activa?: boolean;
  orden?: number;
}): Promise<ZonaEnvioRow> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la zona es obligatorio.");
  const costo = Math.max(0, Math.round(Number(input.costoPesos) * 100));
  const supabase = createClient();
  const { data, error } = await supabase
    .from("zonas_envio")
    .insert({
      nombre,
      cobertura: input.cobertura?.trim() || null,
      costo_envio: costo,
      activa: input.activa ?? true,
      orden: input.orden ?? 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    costo_envio: Number(data.costo_envio) || 0,
    activa: !!data.activa,
    orden: Number(data.orden) || 0,
  } as ZonaEnvioRow;
}

export async function updateZona(input: {
  id: string;
  nombre?: string;
  cobertura?: string | null;
  costoPesos?: number;
  activa?: boolean;
  orden?: number;
}): Promise<ZonaEnvioRow> {
  const patch: {
    updated_at: string;
    nombre?: string;
    cobertura?: string | null;
    costo_envio?: number;
    activa?: boolean;
    orden?: number;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (input.nombre !== undefined) {
    const nombre = input.nombre.trim();
    if (!nombre) throw new Error("El nombre de la zona es obligatorio.");
    patch.nombre = nombre;
  }
  if (input.cobertura !== undefined) {
    patch.cobertura = input.cobertura?.trim() || null;
  }
  if (input.costoPesos !== undefined) {
    patch.costo_envio = Math.max(0, Math.round(Number(input.costoPesos) * 100));
  }
  if (input.activa !== undefined) patch.activa = input.activa;
  if (input.orden !== undefined) patch.orden = input.orden;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("zonas_envio")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    costo_envio: Number(data.costo_envio) || 0,
    activa: !!data.activa,
    orden: Number(data.orden) || 0,
  } as ZonaEnvioRow;
}

export async function deleteZona(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("zonas_envio").delete().eq("id", id);
  if (error) {
    // FK desde pedidos: desactivar en lugar de borrar
    if (/foreign key|violates/i.test(error.message)) {
      await updateZona({ id, activa: false });
      return;
    }
    throw new Error(error.message);
  }
}
