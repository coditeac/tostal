"use client";

import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { formatoMoneda, hoyISO } from "@/lib/format";
import { useRestaurantPedidoEvents } from "@/lib/use-pedido-events";
import {
  normalizarEstado,
  patchEstadoPedido,
  type EstadoFlujo,
} from "@/lib/estados";
import { EstadoAcciones } from "@/components/estado-acciones";
import type { PedidoPublico } from "../../../../../../shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Pedido = PedidoPublico;

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const mergePedido = useCallback(
    (p: Pedido) => {
      setPedidos((prev) => {
        if (p.fechaEntrega !== fecha) {
          return prev.filter((x) => x.id !== p.id);
        }
        const idx = prev.findIndex((x) => x.id === p.id);
        if (idx === -1) return [p, ...prev];
        const next = [...prev];
        next[idx] = p;
        return next;
      });
    },
    [fecha]
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/pedidos?fecha=${fecha}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setPedidos(data.pedidos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga por fecha
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  useRestaurantPedidoEvents(fecha, {
    onSnapshot: (list) => {
      setPedidos(list);
      setLoading(false);
      setLive(true);
    },
    onEvent: (_type, pedido) => {
      mergePedido(pedido);
      setLive(true);
    },
    onError: () => setLive(false),
  });

  async function cambiarEstado(id: string, estado: EstadoFlujo) {
    setBusyId(id);
    setError(null);
    try {
      const result = await patchEstadoPedido(id, estado);
      if (!result.ok) throw new Error(result.error);
      if (result.pedido?.id) {
        mergePedido(result.pedido as unknown as Pedido);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function marcarPagado(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await apiFetch("/api/pedidos", {
        method: "PATCH",
        body: JSON.stringify({ id, estadoPago: "pagado" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.pedido) mergePedido(data.pedido);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Cola del día · avanza el estado y confirma pagos
          {live ? (
            <Badge variant="success-light" size="sm" className="ml-2">
              ● En vivo
            </Badge>
          ) : null}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fecha">Fecha de entrega</Label>
        <Input
          id="fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : pedidos.length === 0 ? (
        <p className="empty-state">No hay pedidos para esta fecha.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {pedidos.map((p) => {
            const estadoUi = normalizarEstado(p.estado);
            return (
              <li key={p.id} className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.codigo}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.clienteNombre} · {p.clienteTelefono}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.canal} · {p.modoEntrega} · {p.metodoPago}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatoMoneda(p.total)}
                    </p>
                    <Badge
                      variant={
                        p.estadoPago === "pagado"
                          ? "success-light"
                          : "warning-light"
                      }
                      size="sm"
                      className="mt-1"
                    >
                      {p.estadoPago}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm">
                  {p.lineas
                    .map((l) => `${l.cantidad}× ${l.productoNombre}`)
                    .join(" · ")}
                </p>

                <EstadoAcciones
                  estado={estadoUi}
                  modoEntrega={p.modoEntrega}
                  busy={busyId === p.id}
                  onCambiar={(estado) => void cambiarEstado(p.id, estado)}
                />

                {p.estadoPago === "pendiente" &&
                  p.metodoPago === "transferencia" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === p.id}
                      className="min-h-[var(--tap)]"
                      onClick={() => void marcarPagado(p.id)}
                    >
                      Marcar pagado
                    </Button>
                  )}

                {estadoUi === "preparando" || estadoUi === "aceptado" ? (
                  <p className="text-xs text-muted-foreground">
                    Al pasar a «Preparando» se descuentan insumos de la
                    receta (si aplica).
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
