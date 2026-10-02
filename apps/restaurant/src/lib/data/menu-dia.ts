"use client";

import { createClient } from "@/lib/supabase/client";
import { getConfigNegocio } from "@/lib/data/config";
import { hoyISO, isoToHoraCdmx, sumarDias } from "@/lib/timezone";

export type MenuDiaProducto = {
  productoId: string;
  productoNombre: string;
  activo: boolean;
};

export type MenuDia = {
  fecha: string;
  horaLimite: string | null;
  horaLimiteHHmm: string;
  abierto: boolean;
  productos: MenuDiaProducto[];
};

export function horaLimiteInputValue(menu: MenuDia | null): string {
  return menu?.horaLimiteHHmm || "18:00";
}

async function defaultHoraLimite(): Promise<string> {
  try {
    const cfg = await getConfigNegocio();
    const h = (cfg.horaLimiteDefault || "").slice(0, 5);
    return /^\d{2}:\d{2}$/.test(h) ? h : "18:00";
  } catch {
    return "18:00";
  }
}

async function mapMenu(fecha: string): Promise<MenuDia> {
  const supabase = createClient();
  const [{ data: dia }, { data: links }, { data: productos }, fallbackHora] =
    await Promise.all([
      supabase.from("menu_dia").select("*").eq("fecha", fecha).maybeSingle(),
      supabase.from("menu_dia_productos").select("*").eq("fecha", fecha),
      supabase.from("productos").select("id, nombre").eq("activo", true),
      defaultHoraLimite(),
    ]);

  const activeMap = new Map(
    (links || []).map((l) => [l.producto_id, l.activo])
  );
  const productosUi: MenuDiaProducto[] = (productos || []).map((p) => ({
    productoId: p.id,
    productoNombre: p.nombre,
    activo: activeMap.has(p.id) ? Boolean(activeMap.get(p.id)) : false,
  }));

  const hora = dia?.hora_limite ? String(dia.hora_limite).slice(0, 5) : null;
  return {
    fecha,
    horaLimite: hora,
    horaLimiteHHmm: hora || fallbackHora,
    abierto: dia ? dia.abierto !== false : false,
    productos: productosUi,
  };
}

export async function getMenuDia(fecha: string): Promise<MenuDia> {
  return mapMenu(fecha);
}

export async function saveMenuDia(input: {
  fecha: string;
  horaLimiteHHmm: string;
  productos: MenuDiaProducto[];
  abierto?: boolean;
}): Promise<MenuDia> {
  const supabase = createClient();
  const hhmm = input.horaLimiteHHmm.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new Error("Hora límite inválida (usa HH:mm CDMX).");
  }

  const { error: e1 } = await supabase.from("menu_dia").upsert({
    fecha: input.fecha,
    hora_limite: `${hhmm}:00`,
    abierto: input.abierto !== false,
    timezone: "America/Mexico_City",
    updated_at: new Date().toISOString(),
  });
  if (e1) throw new Error(e1.message);

  await supabase.from("menu_dia_productos").delete().eq("fecha", input.fecha);
  const rows = input.productos.map((p) => ({
    fecha: input.fecha,
    producto_id: p.productoId,
    activo: p.activo,
  }));
  if (rows.length) {
    const { error: e2 } = await supabase.from("menu_dia_productos").insert(rows);
    if (e2) throw new Error(e2.message);
  }
  return mapMenu(input.fecha);
}

export async function programarMenuDia(
  fecha?: string,
  opts?: { desde?: string; horaLimiteHHmm?: string }
): Promise<MenuDia> {
  const target = fecha || sumarDias(hoyISO(), 1);
  const desde = opts?.desde || hoyISO();
  const base = await mapMenu(desde);
  return saveMenuDia({
    fecha: target,
    horaLimiteHHmm: opts?.horaLimiteHHmm || base.horaLimiteHHmm || "18:00",
    abierto: true,
    productos: base.productos.map((p) => ({ ...p, activo: p.activo })),
  });
}

// Re-export legacy names used by menu-dia.ts consumers
void isoToHoraCdmx;
