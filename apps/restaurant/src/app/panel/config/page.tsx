"use client";

import { apiFetch } from "@/lib/api";

import { useEffect, useState } from "react";

export default function ConfigPage() {
  const [form, setForm] = useState({
    marca: "Tostal",
    eslogan: "Sabores que unen culturas",
    moneda: "MXN",
    canal_remoto_activo: "1",
    canal_mostrador_activo: "0",
    telefono_whatsapp: "",
    direccion_retiro: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/config");
        const data = await res.json();
        if (data.all) {
          setForm((f) => ({
            ...f,
            marca: data.all.marca || f.marca,
            eslogan: data.all.eslogan || f.eslogan,
            moneda: data.all.moneda || f.moneda,
            canal_remoto_activo: data.all.canal_remoto_activo || "1",
            canal_mostrador_activo: data.all.canal_mostrador_activo || "0",
            telefono_whatsapp: data.all.telefono_whatsapp || "",
            direccion_retiro: data.all.direccion_retiro || "",
          }));
        }
      } catch {
        setError("No se pudo cargar la configuración");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function guardar() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await apiFetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMsg("Guardado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading-pulse text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Configuración</h1>
        <p className="text-sm text-muted-foreground">Marca, canales y datos de contacto</p>
      </div>

      <section className="surface space-y-3 p-4">
        <div>
          <label className="label">Marca</label>
          <input
            className="field"
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Eslogan</label>
          <input
            className="field"
            value={form.eslogan}
            onChange={(e) => setForm({ ...form, eslogan: e.target.value })}
          />
        </div>
        <div>
          <label className="label">WhatsApp del negocio</label>
          <input
            className="field"
            value={form.telefono_whatsapp}
            onChange={(e) =>
              setForm({ ...form, telefono_whatsapp: e.target.value })
            }
          />
        </div>
        <div>
          <label className="label">Dirección de retiro</label>
          <input
            className="field"
            value={form.direccion_retiro}
            onChange={(e) =>
              setForm({ ...form, direccion_retiro: e.target.value })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.canal_remoto_activo === "1"}
            onChange={(e) =>
              setForm({
                ...form,
                canal_remoto_activo: e.target.checked ? "1" : "0",
              })
            }
          />
          Canal remoto activo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.canal_mostrador_activo === "1"}
            onChange={(e) =>
              setForm({
                ...form,
                canal_mostrador_activo: e.target.checked ? "1" : "0",
              })
            }
          />
          Canal mostrador activo (local)
        </label>

        {msg && <p className="text-sm text-ok">{msg}</p>}
        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={saving}
          onClick={guardar}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </section>

      <section className="surface p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-cacao">Pagos Stripe</p>
        <p className="mt-1">
          Sin <code>STRIPE_SECRET_KEY</code> el checkout usa modo mock: los
          pedidos con método Stripe quedan marcados como pagados. Documentado en
          el README.
        </p>
      </section>
    </div>
  );
}
