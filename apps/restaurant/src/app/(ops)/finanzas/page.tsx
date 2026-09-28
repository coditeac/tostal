"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { formatoMoneda, hoyISO } from "@/lib/format";

type Gasto = {
  id: string;
  categoria: string;
  monto: number;
  fecha: string;
  metodoPago: string | null;
  notas: string | null;
};

type Resumen = {
  total: number;
  ventas: number;
  gastosVsVentas: number | null;
  porCategoria: Array<{ categoria: string; monto: number }>;
  desde: string;
  hasta: string;
};

type Tab = "gastos" | "ingresos";

export default function FinanzasPage() {
  const [tab, setTab] = useState<Tab>("gastos");
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoria: "otros",
    montoPesos: "",
    fecha: hoyISO(),
    metodoPago: "efectivo",
    notas: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/gastos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setGastos(data.gastos || []);
      setResumen(data.resumen || null);
      setCategorias(data.categorias || []);
      if (data.categorias?.[0]) {
        setForm((f) => ({ ...f, categoria: f.categoria || data.categorias[0] }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: form.categoria,
          montoPesos: Number(form.montoPesos),
          fecha: form.fecha,
          metodoPago: form.metodoPago,
          notas: form.notas || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setForm((f) => ({ ...f, montoPesos: "", notas: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function borrar(id: string) {
    await apiFetch(`/api/gastos?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) {
    return (
      <p className="loading-pulse text-muted-foreground">Cargando finanzas…</p>
    );
  }

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gastos e ingresos del negocio
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {resumen && (
        <div className="flex gap-8 border-y border-border py-5">
          <div>
            <p className="text-xs text-muted-foreground">Gastos (30 días)</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {formatoMoneda(resumen.total)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ingresos / ventas</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {formatoMoneda(resumen.ventas)}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-4 border-b border-border text-sm">
        {(
          [
            { id: "gastos", label: "Gastos" },
            { id: "ingresos", label: "Ingresos" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 pb-2.5 transition-colors ${
              tab === t.id
                ? "border-miel font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ingresos" ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ingresos = ventas de pedidos del período. Las compras confirmadas
            van como gasto en Finanzas.
          </p>
          {resumen ? (
            <ul className="divide-y divide-border border-y border-border text-sm">
              <li className="flex justify-between py-3.5">
                <span>
                  Ventas ({resumen.desde} → {resumen.hasta})
                </span>
                <span className="font-semibold tabular-nums">
                  {formatoMoneda(resumen.ventas)}
                </span>
              </li>
              {resumen.gastosVsVentas != null && (
                <li className="flex justify-between py-3.5 text-muted-foreground">
                  <span>Gastos vs ventas</span>
                  <span>{resumen.gastosVsVentas}%</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="empty-state">Sin datos de ingresos aún.</p>
          )}
        </section>
      ) : (
        <>
          <section className="space-y-3 border-y border-border py-4">
            <h2 className="text-sm font-semibold">Nuevo gasto</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Categoría</label>
                <select
                  className="field"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({ ...form, categoria: e.target.value })
                  }
                >
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Monto (MXN)</label>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  value={form.montoPesos}
                  onChange={(e) =>
                    setForm({ ...form, montoPesos: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Fecha</label>
                <input
                  className="field"
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Pago</label>
                <select
                  className="field"
                  value={form.metodoPago}
                  onChange={(e) =>
                    setForm({ ...form, metodoPago: e.target.value })
                  }
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notas</label>
              <input
                className="field"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={saving || !form.montoPesos}
              onClick={() => void guardar()}
            >
              {saving ? "Guardando…" : "Registrar gasto"}
            </button>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Recientes</h2>
            {gastos.length === 0 ? (
              <p className="empty-state">Sin gastos registrados.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {gastos.slice(0, 30).map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 py-3.5 text-sm"
                  >
                    <div>
                      <p className="font-medium capitalize">{g.categoria}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.fecha}
                        {g.notas ? ` · ${g.notas}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">
                        {formatoMoneda(g.monto)}
                      </p>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground"
                        onClick={() => void borrar(g.id)}
                      >
                        Borrar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
