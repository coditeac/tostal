"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { hoyISO, labelFecha, sumarDias } from "@/lib/utils";
import {
  getMenuDia,
  horaLimiteInputValue,
  programarMenuDia,
  saveMenuDia,
  type MenuDia,
  type MenuDiaProducto,
} from "@/lib/menu-dia";

/** Activar/desactivar productos por día de venta (CDMX). */
export function MenuDiaPanel() {
  const hoy = hoyISO();
  const manana = sumarDias(hoy, 1);
  const [fecha, setFecha] = useState(manana);
  const [menu, setMenu] = useState<MenuDia | null>(null);
  const [productos, setProductos] = useState<MenuDiaProducto[]>([]);
  const [horaLimite, setHoraLimite] = useState("18:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const fechas = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => sumarDias(hoy, i));
  }, [hoy]);

  const activos = productos.filter((p) => p.activo).length;

  async function load(f: string) {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const data = await getMenuDia(f);
      setMenu(data);
      setProductos(data.productos);
      setHoraLimite(horaLimiteInputValue(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setMenu(null);
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(fecha);
  }, [fecha]);

  async function guardar() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const saved = await saveMenuDia({
        fecha,
        horaLimiteHHmm: horaLimite,
        productos,
        abierto: menu?.abierto,
      });
      setMenu(saved);
      setProductos(saved.productos);
      setHoraLimite(horaLimiteInputValue(saved));
      setOkMsg(
        `Menú del ${labelFecha(fecha)} guardado · ${activos} productos · límite ${horaLimite} CDMX`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function programarManana() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      setFecha(manana);
      const data = await programarMenuDia(manana, {
        desde: hoy,
        horaLimiteHHmm: horaLimite || "18:00",
      });
      setMenu(data);
      setProductos(data.productos);
      setHoraLimite(horaLimiteInputValue(data));
      setOkMsg(`Menú de mañana (${labelFecha(manana)}) listo para revisar`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al programar");
    } finally {
      setSaving(false);
    }
  }

  function toggleTodos(activo: boolean) {
    setProductos((list) => list.map((p) => ({ ...p, activo })));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Activa por día de venta y define hora límite (CDMX). Suele programarse
          D+1.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => void programarManana()}
        >
          Programar mañana
        </Button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {fechas.map((f) => {
          const active = f === fecha;
          const esHoy = f === hoy;
          const esManana = f === manana;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFecha(f)}
              className={`min-w-[4.4rem] rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                active
                  ? "bg-miel text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              <p className="text-[11px] opacity-80">
                {esHoy ? "Hoy" : esManana ? "Mañana" : labelFecha(f)}
              </p>
              <p className="font-semibold tabular-nums">{f.slice(8)}</p>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--tostal-ok)_12%,white)] px-3 py-2 text-sm text-ok">
          {okMsg}
        </p>
      )}

      {loading ? (
        <p className="loading-pulse text-sm text-muted-foreground">
          Cargando menú…
        </p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3 border-y border-border py-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Fecha (CDMX)
                </p>
                <p className="mt-0.5 font-semibold">{labelFecha(fecha)}</p>
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">
                {activos}/{productos.length} activos
              </p>
            </div>

            <div>
              <label className="label" htmlFor="hora-limite">
                Hora límite de pedidos (CDMX)
              </label>
              <input
                id="hora-limite"
                type="time"
                className="field max-w-[10rem]"
                value={horaLimite}
                onChange={(e) => setHoraLimite(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pasada esa hora el cliente no puede pedir este día.
              </p>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Productos del día</h2>
              <div className="flex gap-3 text-xs font-semibold">
                <button
                  type="button"
                  className="text-miel"
                  onClick={() => toggleTodos(true)}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => toggleTodos(false)}
                >
                  Ninguno
                </button>
              </div>
            </div>

            {productos.length === 0 ? (
              <p className="empty-state">
                No hay productos en catálogo. Créalos en la pestaña Catálogo.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {productos.map((p) => (
                  <li
                    key={p.productoId}
                    className="flex items-center justify-between gap-3 py-3.5"
                  >
                    <span className="text-sm font-medium">
                      {p.productoNombre}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {p.activo ? "Activo" : "Off"}
                      </span>
                      <Switch
                        checked={p.activo}
                        onCheckedChange={(checked) =>
                          setProductos((list) =>
                            list.map((x) =>
                              x.productoId === p.productoId
                                ? { ...x, activo: checked }
                                : x
                            )
                          )
                        }
                        aria-label={`Activar ${p.productoNombre}`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Button
            type="button"
            className="w-full"
            disabled={saving || productos.length === 0}
            onClick={() => void guardar()}
          >
            {saving ? "Guardando…" : "Guardar menú del día"}
          </Button>
        </div>
      )}
    </div>
  );
}
