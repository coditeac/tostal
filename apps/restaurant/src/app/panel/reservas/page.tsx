"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatoMoneda, labelFecha } from "@/lib/format";
import { listReservas, type ReservaCola } from "@/lib/reservas";

export default function ReservasPage() {
  const [reservas, setReservas] = useState<ReservaCola[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listReservas();
      setReservas(data.reservas);
      setInfo(data.disponible ? null : data.mensaje || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const conCompra = reservas.filter((r) => r.requiereCompra).length;

  return (
    <div className="space-y-6 rise-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cola de pedidos bajo reserva, insumos y si hay que comprar más.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
        >
          Actualizar
        </Button>
      </div>

      {!loading && reservas.length > 0 && (
        <div className="flex gap-6 border-y border-border py-4">
          <div>
            <p className="text-xs text-muted-foreground">En cola</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {reservas.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Requiere compra</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-alerta">
              {conCompra}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {info}
        </p>
      )}

      {loading ? (
        <p className="loading-pulse text-sm text-muted-foreground">
          Cargando reservas…
        </p>
      ) : reservas.length === 0 && !info ? (
        <p className="empty-state">
          No hay reservas. Cuando un cliente reserve un producto bajo pedido,
          aparece aquí con el desglose de insumos.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {reservas.map((r) => {
            const open = openId === r.id;
            return (
              <li key={r.id} className="py-4">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.codigo || r.id.slice(0, 8)} · {r.clienteNombre}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.fecha ? labelFecha(r.fecha) : "Sin fecha"} ·{" "}
                      {r.estado.replace(/_/g, " ")}
                      {r.productos.length > 0
                        ? ` · ${r.productos
                            .map((p) => `${p.nombre}×${p.cantidad}`)
                            .join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatoMoneda(r.anticipo)}
                    </p>
                    {r.requiereCompra ? (
                      <Badge variant="warning" radius="default">
                        Comprar
                      </Badge>
                    ) : (
                      <Badge variant="success-light" radius="default">
                        Stock OK
                      </Badge>
                    )}
                  </div>
                </button>

                {open && (
                  <div className="mt-3 space-y-3 rounded-xl bg-secondary/60 px-3 py-3">
                    {r.clienteTelefono && (
                      <p className="text-xs text-muted-foreground">
                        Tel. {r.clienteTelefono}
                      </p>
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Insumos necesarios
                      </p>
                      {r.insumosNecesarios.length === 0 ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Sin desglose de insumos.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {r.insumosNecesarios.map((i) => (
                            <li
                              key={`${r.id}-${i.insumoId}`}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {i.nombre}{" "}
                                <span className="text-muted-foreground">
                                  {i.cantidadNecesaria}
                                  {i.unidad}
                                </span>
                              </span>
                              <span
                                className={
                                  i.requiereCompra
                                    ? "font-medium text-alerta"
                                    : "text-muted-foreground"
                                }
                              >
                                stock {i.stockActual}
                                {i.requiereCompra
                                  ? ` · faltan ${i.faltante}`
                                  : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {r.sugerenciasCompra && r.sugerenciasCompra.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Sugerencias de compra
                        </p>
                        <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                          {r.sugerenciasCompra.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
