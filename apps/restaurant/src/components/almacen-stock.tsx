"use client";

import { apiFetch } from "@/lib/api";

import { useEffect, useState } from "react";
import { formatoMoneda } from "@/lib/format";

type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  bajoMinimo?: boolean;
};

type Movimiento = {
  id: string;
  insumoNombre: string;
  unidad: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  creadoEn: string;
};

type Alerta = Insumo & { faltante: number; critico: boolean };

export function AlmacenStock() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    insumoId: "",
    tipo: "entrada",
    cantidad: "",
    motivo: "",
    costoPesos: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/almacen");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const list = (data.insumos || []).map(
        (i: Insumo & Record<string, unknown>) => ({
          ...i,
          stockActual: Number(i.stockActual ?? i.stock_actual ?? 0),
          stockMinimo: Number(
            i.stockMinimo ?? i.stock_minimo ?? i.umbral_pocos ?? 0
          ),
          bajoMinimo: Boolean(i.bajoMinimo ?? i.pocos),
        })
      ) as Insumo[];
      setInsumos(list);
      setMovimientos(data.movimientos || []);
      setAlertas((data.pocos || data.alertas || []) as Alerta[]);
      if (!form.insumoId && list[0]) {
        setForm((f) => ({ ...f, insumoId: list[0].id }));
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

  async function registrar() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/almacen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insumoId: form.insumoId,
          tipo: form.tipo,
          cantidad: Number(form.cantidad),
          motivo: form.motivo || null,
          costoPesos: form.costoPesos ? Number(form.costoPesos) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar");
      setForm((f) => ({ ...f, cantidad: "", motivo: "", costoPesos: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function guardarUmbral(insumoId: string, stockMinimo: number) {
    setError(null);
    const res = await apiFetch("/api/almacen/umbral", {
      method: "PUT",
      body: JSON.stringify({ insumoId, stockMinimo, umbral_pocos: stockMinimo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo guardar el umbral");
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="loading-pulse text-muted-foreground">Cargando almacén…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {alertas.length > 0 && (
        <section className="surface border-alerta/40 p-4">
          <h2 className="font-semibold text-alerta">Falta stock</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {alertas.map((a) => (
              <li key={a.id}>
                {a.critico ? "⚠ " : ""}
                {a.nombre}: {a.stockActual} {a.unidad} (mín. {a.stockMinimo})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="surface space-y-3 p-4">
        <h2 className="font-semibold">Registrar movimiento</h2>
        <div>
          <label className="label">Insumo</label>
          <select
            className="field"
            value={form.insumoId}
            onChange={(e) => setForm({ ...form, insumoId: e.target.value })}
          >
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.stockActual} {i.unidad})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Tipo</label>
            <select
              className="field"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="merma">Merma</option>
              <option value="ajuste">Ajuste (+)</option>
            </select>
          </div>
          <div>
            <label className="label">Cantidad</label>
            <input
              className="field"
              type="number"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
          </div>
        </div>
        {form.tipo === "entrada" && (
          <div>
            <label className="label">Costo unitario (MXN, opcional)</label>
            <input
              className="field"
              type="number"
              step="0.001"
              value={form.costoPesos}
              onChange={(e) => setForm({ ...form, costoPesos: e.target.value })}
            />
          </div>
        )}
        <div>
          <label className="label">Motivo</label>
          <input
            className="field"
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            placeholder="Compra, merma, ajuste…"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={saving || !form.cantidad}
          onClick={registrar}
        >
          {saving ? "Guardando…" : "Registrar"}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Stock actual</h2>
        <ul className="space-y-2">
          {insumos.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3.5 text-sm first:border-t"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {i.nombre}
                  {i.bajoMinimo && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-alerta">
                      Pocos
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {formatoMoneda(i.costoUnitario)} / {i.unidad}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Mín.
                  <input
                    className="field w-16 py-1 text-sm"
                    type="number"
                    defaultValue={i.stockMinimo}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== i.stockMinimo) {
                        void guardarUmbral(i.id, v);
                      }
                    }}
                  />
                </label>
                <p className="font-semibold tabular-nums">
                  {i.stockActual} {i.unidad}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Últimos movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay movimientos.</p>
        ) : (
          <ul className="space-y-2">
            {movimientos.map((m) => (
              <li key={m.id} className="border-b border-border py-3.5 text-sm first:border-t">
                <p className="font-medium">
                  {m.tipo}: {m.cantidad} {m.unidad} · {m.insumoNombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.motivo || "—"} ·{" "}
                  {new Date(m.creadoEn).toLocaleString("es-MX", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
