"use client";

import { createClient } from "@/lib/supabase/client";

/** Claves de negocio que Nest persistía en `configuracion` (subset crítico + panel Ajustes). */
export const CONFIG_KEYS = {
  marca: "marca",
  eslogan: "eslogan",
  moneda: "moneda",
  telefonoWhatsapp: "telefono_whatsapp",
  direccionRetiro: "direccion_retiro",
  horaLimiteDefault: "hora_limite_default",
  mensajeWhatsapp: "mensaje_whatsapp",
  canalRemotoActivo: "canal_remoto_activo",
  canalMostradorActivo: "canal_mostrador_activo",
  checkoutRequiereCuenta: "checkout_requiere_cuenta",
  checkoutRecomiendaCuenta: "checkout_recomienda_cuenta",
} as const;

export type ConfigNegocio = {
  marca: string;
  telefonoWhatsapp: string;
  horaLimiteDefault: string;
  mensajeWhatsapp: string;
  direccionRetiro: string;
  eslogan: string;
};

export const CONFIG_DEFAULTS: ConfigNegocio = {
  marca: "Tostal",
  telefonoWhatsapp: "",
  horaLimiteDefault: "18:00",
  mensajeWhatsapp: "",
  direccionRetiro: "",
  eslogan: "Sabores que unen culturas",
};

export async function getConfigMap(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("configuracion")
    .select("clave, valor");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor]));
}

export async function getConfigNegocio(): Promise<ConfigNegocio> {
  const map = await getConfigMap();
  return {
    marca: map[CONFIG_KEYS.marca] || CONFIG_DEFAULTS.marca,
    telefonoWhatsapp:
      map[CONFIG_KEYS.telefonoWhatsapp] || CONFIG_DEFAULTS.telefonoWhatsapp,
    horaLimiteDefault:
      map[CONFIG_KEYS.horaLimiteDefault] || CONFIG_DEFAULTS.horaLimiteDefault,
    mensajeWhatsapp:
      map[CONFIG_KEYS.mensajeWhatsapp] || CONFIG_DEFAULTS.mensajeWhatsapp,
    direccionRetiro:
      map[CONFIG_KEYS.direccionRetiro] || CONFIG_DEFAULTS.direccionRetiro,
    eslogan: map[CONFIG_KEYS.eslogan] || CONFIG_DEFAULTS.eslogan,
  };
}

export async function saveConfigNegocio(
  input: Pick<
    ConfigNegocio,
    "marca" | "telefonoWhatsapp" | "horaLimiteDefault" | "mensajeWhatsapp"
  > & { direccionRetiro?: string }
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const rows = [
    { clave: CONFIG_KEYS.marca, valor: input.marca.trim() || "Tostal", updated_at: now },
    {
      clave: CONFIG_KEYS.telefonoWhatsapp,
      valor: input.telefonoWhatsapp.trim(),
      updated_at: now,
    },
    {
      clave: CONFIG_KEYS.horaLimiteDefault,
      valor: input.horaLimiteDefault.trim() || "18:00",
      updated_at: now,
    },
    {
      clave: CONFIG_KEYS.mensajeWhatsapp,
      valor: input.mensajeWhatsapp,
      updated_at: now,
    },
  ];
  if (input.direccionRetiro !== undefined) {
    rows.push({
      clave: CONFIG_KEYS.direccionRetiro,
      valor: input.direccionRetiro.trim(),
      updated_at: now,
    });
  }
  const { error } = await supabase.from("configuracion").upsert(rows, {
    onConflict: "clave",
  });
  if (error) throw new Error(error.message);
}
