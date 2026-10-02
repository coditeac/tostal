"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CONFIG_DEFAULTS,
  getConfigNegocio,
  saveConfigNegocio,
  type ConfigNegocio,
} from "@/lib/data/config";

type FormState = Pick<
  ConfigNegocio,
  "marca" | "telefonoWhatsapp" | "horaLimiteDefault" | "mensajeWhatsapp" | "direccionRetiro"
>;

/**
 * Ajustes de negocio — persisten en Supabase `configuracion` (key-value).
 * Reemplaza el localStorage post-migración Nest.
 */
export default function ConfigPanel() {
  const [form, setForm] = useState<FormState>({
    marca: CONFIG_DEFAULTS.marca,
    telefonoWhatsapp: CONFIG_DEFAULTS.telefonoWhatsapp,
    horaLimiteDefault: CONFIG_DEFAULTS.horaLimiteDefault,
    mensajeWhatsapp: CONFIG_DEFAULTS.mensajeWhatsapp,
    direccionRetiro: CONFIG_DEFAULTS.direccionRetiro,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await getConfigNegocio();
        if (!alive) return;
        setForm({
          marca: cfg.marca,
          telefonoWhatsapp: cfg.telefonoWhatsapp,
          horaLimiteDefault: cfg.horaLimiteDefault,
          mensajeWhatsapp: cfg.mensajeWhatsapp,
          direccionRetiro: cfg.direccionRetiro,
        });
        setError(null);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la configuración"
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setOk(null);
    setError(null);
    try {
      await saveConfigNegocio(form);
      setOk("Configuración guardada en Supabase (todos los dispositivos).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Cargando configuración…</p>
    );
  }

  return (
    <form onSubmit={(e) => void onSave(e)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ajustes de negocio compartidos (tabla{" "}
        <code className="text-xs">configuracion</code>). Auth y roles van por{" "}
        <code className="text-xs">profiles.rol</code>.
      </p>
      <div>
        <label className="label" htmlFor="cfg-marca">
          Nombre del negocio
        </label>
        <input
          id="cfg-marca"
          className="field"
          value={form.marca}
          onChange={(e) => setForm({ ...form, marca: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="cfg-tel">
          Teléfono / WhatsApp
        </label>
        <input
          id="cfg-tel"
          className="field"
          value={form.telefonoWhatsapp}
          onChange={(e) =>
            setForm({ ...form, telefonoWhatsapp: e.target.value })
          }
          placeholder="52155…"
        />
      </div>
      <div>
        <label className="label" htmlFor="cfg-dir">
          Dirección de retiro
        </label>
        <input
          id="cfg-dir"
          className="field"
          value={form.direccionRetiro}
          onChange={(e) =>
            setForm({ ...form, direccionRetiro: e.target.value })
          }
        />
      </div>
      <div>
        <label className="label" htmlFor="cfg-hora">
          Hora límite default (CDMX)
        </label>
        <input
          id="cfg-hora"
          className="field"
          type="time"
          value={form.horaLimiteDefault}
          onChange={(e) =>
            setForm({ ...form, horaLimiteDefault: e.target.value })
          }
        />
      </div>
      <div>
        <label className="label" htmlFor="cfg-wa">
          Mensaje WhatsApp
        </label>
        <textarea
          id="cfg-wa"
          className="field min-h-24"
          value={form.mensajeWhatsapp}
          onChange={(e) =>
            setForm({ ...form, mensajeWhatsapp: e.target.value })
          }
        />
      </div>
      {ok && (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--tostal-ok)_12%,white)] px-3 py-2 text-sm text-ok">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
