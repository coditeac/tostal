"use client";

import {
  createGasto,
  createIngreso,
  deleteGasto,
  deleteIngreso,
  loadFinanzas,
} from "@/lib/data/finanzas";
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

type Ingreso = {
  id: string;
  categoria: string;
  monto: number;
  fecha: string;
  metodoPago: string | null;
  notas: string | null;
  pedidoId?: string | null;
  reservaId?: string | null;
};

type Resumen = {
  totalGastos: number;
  totalIngresos: number;
  balance: number;
  desde: string;
  hasta: string;
  ventasPedidos?: number;
  anticiposReservas?: number;
};

type Tab = "gastos" | "ingresos";

export default function FinanzasPage() {
  const [tab, setTab] = useState<Tab>("gastos");
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [categoriasGasto, setCategoriasGasto] = useState<string[]>([]);
  const [categoriasIngreso, setCategoriasIngreso] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gastoForm, setGastoForm] = useState({
    categoria: "otros",
    montoPesos: "",
    fecha: hoyISO(),
    metodoPago: "efectivo",
    notas: "",
  });
  const [ingresoForm, setIngresoForm] = useState({
    categoria: "ventas",
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
      const data = await loadFinanzas();
      setGastos(data.gastos || []);
      setIngresos(data.ingresos || []);
      setResumen(data.resumen);
      setCategoriasGasto(data.categorias_gasto || []);
      setCategoriasIngreso(data.categorias_ingreso || []);
      if ((data.categorias_gasto || [])[0]) {
        setGastoForm((f) => ({
          ...f,
          categoria: f.categoria || data.categorias_gasto[0],
        }));
      }
      if ((data.categorias_ingreso || [])[0]) {
        setIngresoForm((f) => ({
          ...f,
          categoria: f.categoria || data.categorias_ingreso[0],
        }));
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

  async function guardarGasto() {
    setSaving(true);
    setError(null);
    try {
      await createGasto({
        categoria: gastoForm.categoria,
        montoPesos: Number(gastoForm.montoPesos),
        notas: gastoForm.notas || undefined,
      });
      setGastoForm((f) => ({ ...f, montoPesos: "", notas: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function guardarIngreso() {
    setSaving(true);
    setError(null);
    try {
      await createIngreso({
        categoria: ingresoForm.categoria,
        montoPesos: Number(ingresoForm.montoPesos),
        notas: ingresoForm.notas || undefined,
      });
      setIngresoForm((f) => ({ ...f, montoPesos: "", notas: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function borrarGasto(id: string) {
    await deleteGasto(id);
    await load();
  }

  async function borrarIngreso(id: string) {
    await deleteIngreso(id);
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
        <div className="flex flex-wrap gap-8 border-y border-border py-5">
          <div>
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {formatoMoneda(resumen.totalIngresos)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {formatoMoneda(resumen.totalGastos)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${
                resumen.balance >= 0 ? "text-ok" : "text-error"
              }`}
            >
              {formatoMoneda(resumen.balance)}
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
        <>
          {resumen &&
            (resumen.ventasPedidos || resumen.anticiposReservas) && (
              <ul className="divide-y divide-border border-y border-border text-sm">
                <li className="flex justify-between py-3">
                  <span className="text-muted-foreground">Ventas pedidos</span>
                  <span className="tabular-nums">
                    {formatoMoneda(resumen.ventasPedidos || 0)}
                  </span>
                </li>
                <li className="flex justify-between py-3">
                  <span className="text-muted-foreground">
                    Anticipos reservas
                  </span>
                  <span className="tabular-nums">
                    {formatoMoneda(resumen.anticiposReservas || 0)}
                  </span>
                </li>
              </ul>
            )}

          <section className="space-y-3 border-y border-border py-4">
            <h2 className="text-sm font-semibold">Nuevo ingreso</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Categoría</label>
                <select
                  className="field"
                  value={ingresoForm.categoria}
                  onChange={(e) =>
                    setIngresoForm({
                      ...ingresoForm,
                      categoria: e.target.value,
                    })
                  }
                >
                  {(categoriasIngreso.length
                    ? categoriasIngreso
                    : ["ventas", "anticipos", "otros"]
                  ).map((c) => (
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
                  value={ingresoForm.montoPesos}
                  onChange={(e) =>
                    setIngresoForm({
                      ...ingresoForm,
                      montoPesos: e.target.value,
                    })
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
                  value={ingresoForm.fecha}
                  onChange={(e) =>
                    setIngresoForm({ ...ingresoForm, fecha: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Pago</label>
                <select
                  className="field"
                  value={ingresoForm.metodoPago}
                  onChange={(e) =>
                    setIngresoForm({
                      ...ingresoForm,
                      metodoPago: e.target.value,
                    })
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
                value={ingresoForm.notas}
                onChange={(e) =>
                  setIngresoForm({ ...ingresoForm, notas: e.target.value })
                }
              />
            </div>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={saving || !ingresoForm.montoPesos}
              onClick={() => void guardarIngreso()}
            >
              {saving ? "Guardando…" : "Registrar ingreso"}
            </button>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Recientes</h2>
            {ingresos.length === 0 ? (
              <p className="empty-state">Sin ingresos registrados.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {ingresos.slice(0, 30).map((g) => (
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
                      <p className="font-semibold tabular-nums text-ok">
                        {formatoMoneda(g.monto)}
                      </p>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground"
                        onClick={() => void borrarIngreso(g.id)}
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
      ) : (
        <>
          <section className="space-y-3 border-y border-border py-4">
            <h2 className="text-sm font-semibold">Nuevo gasto</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Categoría</label>
                <select
                  className="field"
                  value={gastoForm.categoria}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, categoria: e.target.value })
                  }
                >
                  {(categoriasGasto.length
                    ? categoriasGasto
                    : ["insumos", "otros"]
                  ).map((c) => (
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
                  value={gastoForm.montoPesos}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, montoPesos: e.target.value })
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
                  value={gastoForm.fecha}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, fecha: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Pago</label>
                <select
                  className="field"
                  value={gastoForm.metodoPago}
                  onChange={(e) =>
                    setGastoForm({ ...gastoForm, metodoPago: e.target.value })
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
                value={gastoForm.notas}
                onChange={(e) =>
                  setGastoForm({ ...gastoForm, notas: e.target.value })
                }
              />
            </div>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={saving || !gastoForm.montoPesos}
              onClick={() => void guardarGasto()}
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
                        onClick={() => void borrarGasto(g.id)}
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
