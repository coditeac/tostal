"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ConfigLocal = {
  nombreNegocio: string;
  telefono: string;
  horaLimiteDefault: string;
  mensajeWhatsapp: string;
};

const KEY = "tostal.restaurant.config.v1";
const DEFAULTS: ConfigLocal = {
  nombreNegocio: "Tostal",
  telefono: "",
  horaLimiteDefault: "18:00",
  mensajeWhatsapp: "",
};

/**
 * Config local (sin tabla Supabase aún). Persistencia en localStorage del staff.
 */
export default function ConfigPanel() {
  const [form, setForm] = useState<ConfigLocal>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setForm({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setOk(null);
    try {
      localStorage.setItem(KEY, JSON.stringify(form));
      setOk("Configuración guardada en este dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ajustes locales del panel. Auth y datos operativos van por Supabase (
        <code className="text-xs">profiles.rol</code>).
      </p>
      <div>
        <label className="label">Nombre del negocio</label>
        <input
          className="field"
          value={form.nombreNegocio}
          onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Teléfono</label>
        <input
          className="field"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Hora límite default (CDMX)</label>
        <input
          className="field"
          type="time"
          value={form.horaLimiteDefault}
          onChange={(e) =>
            setForm({ ...form, horaLimiteDefault: e.target.value })
          }
        />
      </div>
      <div>
        <label className="label">Mensaje WhatsApp</label>
        <textarea
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
      <Button type="submit" disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
