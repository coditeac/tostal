"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatoMoneda } from "@/lib/format";
import {
  listInsumos,
  mapInsumoUi,
  moverStock,
  updateInsumo,
} from "@/lib/data/insumos";
import {
  listTiendasProveedor,
  type TiendaProveedorRow,
} from "@/lib/data/tiendas-proveedor";

type Insumo = {
  id: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  proveedorPreferidoId?: string | null;
  bajoMinimo?: boolean;
};

type Alerta = Insumo & { faltante: number; critico: boolean };

export function AlmacenStock() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [tiendas, setTiendas] = useState<TiendaProveedorRow[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    insumoId: "",
    tipo: "entrada",
    cantidad: "",
    motivo: "",
    costoPesos: "",
    proveedorId: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rows, shops] = await Promise.all([
        listInsumos(),
        listTiendasProveedor({ soloActivas: true }),
      ]);
      const list = rows.map(mapInsumoUi) as Insumo[];
      setInsumos(list);
      setTiendas(shops);
      setAlertas(
        list
          .filter((i) => i.bajoMinimo)
          .map((i) => ({
            ...i,
            faltante: Math.max(0, i.stockMinimo - i.stockActual),
            critico: i.stockActual <= 0,
          }))
      );
      if (!form.insumoId && list[0]) {
        setForm((f) => ({
          ...f,
          insumoId: list[0].id,
          proveedorId: list[0].proveedorPreferidoId || f.proveedorId,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registrar() {
    setSaving(true);
    setError(null);
    try {
      const proveedorNombre =
        tiendas.find((t) => t.id === form.proveedorId)?.nombre ?? null;
      await moverStock({
        insumoId: form.insumoId,
        tipo: form.tipo,
        cantidad: Number(form.cantidad),
        costoPesos: form.costoPesos ? Number(form.costoPesos) : null,
        proveedorId:
          form.tipo === "entrada" && form.proveedorId
            ? form.proveedorId
            : null,
        proveedorNombre:
          form.tipo === "entrada" ? proveedorNombre : null,
      });
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
    try {
      await updateInsumo(insumoId, { umbral_pocos: stockMinimo });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el umbral");
    }
  }

  if (loading) {
    return <p className="loading-pulse text-muted-foreground">Cargando almacén…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error" role="alert">{error}</p>
      )}

      {alertas.length > 0 && (
        <section className="surface border-alerta/40 p-4" aria-labelledby="alerta-stock">
          <h2 id="alerta-stock" className="font-semibold text-alerta">Falta stock</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {alertas.map((a) => (
              <li key={a.id}>
                {a.critico ? (
                  <span className="sr-only">Crítico: </span>
                ) : null}
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
          <label className="label" htmlFor="mov-insumo">
            Insumo
          </label>
          <select
            id="mov-insumo"
            className="field"
            value={form.insumoId}
            onChange={(e) => {
              const id = e.target.value;
              const insumo = insumos.find((i) => i.id === id);
              setForm({
                ...form,
                insumoId: id,
                proveedorId:
                  insumo?.proveedorPreferidoId || form.proveedorId || "",
              });
            }}
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
            <label className="label" htmlFor="mov-tipo">
              Tipo
            </label>
            <select
              id="mov-tipo"
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
            <label className="label" htmlFor="mov-cantidad">
              Cantidad
            </label>
            <input
              id="mov-cantidad"
              className="field"
              type="number"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
          </div>
        </div>
        {form.tipo === "entrada" && (
          <>
            <div>
              <label className="label" htmlFor="mov-proveedor">
                Tienda / proveedor
              </label>
              {tiendas.length === 0 ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Agrega tiendas en{" "}
                  <Link href="/ajustes" className="font-semibold text-miel">
                    Configuración
                  </Link>
                  .
                </p>
              ) : (
                <select
                  id="mov-proveedor"
                  className="field"
                  value={form.proveedorId}
                  onChange={(e) =>
                    setForm({ ...form, proveedorId: e.target.value })
                  }
                >
                  <option value="">Sin tienda</option>
                  {tiendas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="label" htmlFor="mov-costo">
                Costo unitario (MXN, opcional)
              </label>
              <input
                id="mov-costo"
                className="field"
                type="number"
                step="0.001"
                value={form.costoPesos}
                onChange={(e) =>
                  setForm({ ...form, costoPesos: e.target.value })
                }
              />
            </div>
          </>
        )}
        <div>
          <label className="label" htmlFor="mov-motivo">
            Motivo
          </label>
          <input
            id="mov-motivo"
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
          onClick={() => void registrar()}
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
                  <span>Mín.</span>
                  <input
                    className="field w-16 py-1 text-sm"
                    type="number"
                    aria-label={`Umbral mínimo de ${i.nombre}`}
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
    </div>
  );
}
