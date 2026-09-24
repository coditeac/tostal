"use client";

import { useEffect, useMemo, useState } from "react";
import { hoyISO, labelFecha } from "@/lib/format";

type Dia = {
  id: string;
  fecha: string;
  abierto: boolean;
  deadlinePedido: string;
  cupoMaximo: number | null;
  notas: string | null;
};

type Disp = {
  productoId: string;
  disponible: boolean;
  productoNombre: string;
};

export default function CalendarioPage() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [dia, setDia] = useState<Dia | null>(null);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deadlineLocal, setDeadlineLocal] = useState("");

  const proximos = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(`${hoyISO()}T12:00:00`);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  async function loadLista() {
    const res = await fetch("/api/calendario");
    const data = await res.json();
    if (res.ok) setDias(data.dias || []);
  }

  async function loadDia(f: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendario?fecha=${f}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setDia(data.dia);
      setDisp(data.disponibilidad || []);
      if (data.dia?.deadlinePedido) {
        const d = new Date(data.dia.deadlinePedido);
        const pad = (n: number) => String(n).padStart(2, "0");
        setDeadlineLocal(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        );
      } else {
        setDeadlineLocal(`${f}T18:00`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLista();
    loadDia(fecha);
  }, [fecha]);

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      const deadlineIso = new Date(deadlineLocal).toISOString();
      const res = await fetch("/api/calendario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          abierto: dia?.abierto ?? true,
          deadlinePedido: deadlineIso,
          cupoMaximo: dia?.cupoMaximo ?? 20,
          notas: dia?.notas ?? null,
          disponibilidad: disp.map((d) => ({
            productoId: d.productoId,
            disponible: d.disponible,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setDia(data.dia);
      setDisp(data.disponibilidad || []);
      await loadLista();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function copiarAnterior() {
    const idx = proximos.indexOf(fecha);
    if (idx <= 0) return;
    const desde = proximos[idx - 1];
    setSaving(true);
    try {
      const res = await fetch("/api/calendario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, copiarDesde: desde }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setDisp(data.disponibilidad || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Disponibilidad por día y deadline de pedido
        </p>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {proximos.map((f) => {
          const info = dias.find((d) => d.fecha === f);
          const active = f === fecha;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFecha(f)}
              className={`min-w-[4.5rem] rounded-2xl px-3 py-2 text-left text-sm ${
                active
                  ? "bg-cacao text-crema"
                  : "surface text-cacao"
              }`}
            >
              <p className="text-[11px] opacity-80">{labelFecha(f)}</p>
              <p className="font-semibold">{f.slice(8)}</p>
              <p className="text-[10px] opacity-70">
                {info?.abierto === false ? "cerrado" : "abierto"}
              </p>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="loading-pulse text-muted-foreground">Cargando día…</p>
      ) : (
        <section className="surface space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{labelFecha(fecha)}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dia?.abierto ?? true}
                onChange={(e) =>
                  setDia((d) =>
                    d
                      ? { ...d, abierto: e.target.checked }
                      : {
                          id: "",
                          fecha,
                          abierto: e.target.checked,
                          deadlinePedido: new Date(deadlineLocal).toISOString(),
                          cupoMaximo: 20,
                          notas: null,
                        }
                  )
                }
              />
              Día abierto
            </label>
          </div>

          <div>
            <label className="label">Deadline para pedir (fecha y hora)</label>
            <input
              type="datetime-local"
              className="field"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si ya pasó, el cliente no puede ordenar para este día.
            </p>
          </div>

          <div>
            <label className="label">Cupo máximo de pedidos</label>
            <input
              type="number"
              className="field"
              value={dia?.cupoMaximo ?? 20}
              onChange={(e) =>
                setDia((d) =>
                  d
                    ? { ...d, cupoMaximo: Number(e.target.value) }
                    : null
                )
              }
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">Productos disponibles</p>
              <button
                type="button"
                className="text-sm font-semibold text-miel-dark"
                onClick={copiarAnterior}
              >
                Copiar día anterior
              </button>
            </div>
            {disp.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay productos en catálogo.</p>
            ) : (
              <ul className="space-y-2">
                {disp.map((item) => (
                  <li
                    key={item.productoId}
                    className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2"
                  >
                    <span className="text-sm">{item.productoNombre}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.disponible}
                        onChange={(e) =>
                          setDisp((list) =>
                            list.map((x) =>
                              x.productoId === item.productoId
                                ? { ...x, disponible: e.target.checked }
                                : x
                            )
                          )
                        }
                      />
                      Disponible
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={saving}
            onClick={guardar}
          >
            {saving ? "Guardando…" : "Guardar día"}
          </button>
        </section>
      )}
    </div>
  );
}
