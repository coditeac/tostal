"use client";

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

export default function GastosPage() {
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
      const res = await fetch("/api/gastos");
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
    load();
  }, []);

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gastos", {
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
    await fetch(`/api/gastos?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) {
    return <p className="loading-pulse text-muted-foreground">Cargando gastos…</p>;
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Gastos</h1>
        <p className="text-sm text-muted-foreground">Registro y resumen simple</p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {resumen && (
        <section className="surface grid grid-cols-2 gap-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Gastos (30 días)</p>
            <p className="text-xl font-semibold">{formatoMoneda(resumen.total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ventas del período</p>
            <p className="text-xl font-semibold">{formatoMoneda(resumen.ventas)}</p>
          </div>
          {resumen.gastosVsVentas != null && (
            <p className="col-span-2 text-sm text-muted-foreground">
              Gastos = {resumen.gastosVsVentas}% de ventas
            </p>
          )}
          {resumen.porCategoria.length > 0 && (
            <ul className="col-span-2 space-y-1 text-sm">
              {resumen.porCategoria.map((c) => (
                <li key={c.categoria} className="flex justify-between">
                  <span className="capitalize">{c.categoria}</span>
                  <span>{formatoMoneda(c.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="surface space-y-3 p-4">
        <h2 className="font-semibold">Nuevo gasto</h2>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Categoría</label>
            <select
              className="field"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
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
              onChange={(e) => setForm({ ...form, montoPesos: e.target.value })}
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
              onChange={(e) => setForm({ ...form, metodoPago: e.target.value })}
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
          onClick={guardar}
        >
          {saving ? "Guardando…" : "Registrar gasto"}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Recientes</h2>
        {gastos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin gastos registrados.</p>
        ) : (
          <ul className="space-y-2">
            {gastos.slice(0, 30).map((g) => (
              <li key={g.id} className="surface flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium capitalize">{g.categoria}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.fecha}
                    {g.notas ? ` · ${g.notas}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatoMoneda(g.monto)}</p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground"
                    onClick={() => borrar(g.id)}
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
