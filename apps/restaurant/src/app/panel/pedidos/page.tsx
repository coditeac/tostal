"use client";

import { useCallback, useEffect, useState } from "react";
import { formatoMoneda, hoyISO } from "@/lib/format";
import { useRestaurantPedidoEvents } from "@/lib/use-pedido-events";
import type { PedidoPublico } from "../../../../../../shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Pedido = PedidoPublico;

const ESTADOS = [
  "recibido",
  "confirmado",
  "en_produccion",
  "listo",
  "entregado",
  "cancelado",
] as const;

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
      const res = await fetch(`/api/pedidos?fecha=${fecha}`);
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
    load();
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

  async function patch(id: string, body: Record<string, string>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
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
        <h1 className="font-display text-3xl">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Cola del día · producción y pagos
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
        <p className="surface p-4 text-sm text-muted-foreground">
          No hay pedidos para esta fecha.
        </p>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <li key={p.id} className="surface space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.codigo}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.clienteNombre} · {p.clienteTelefono}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.canal} · {p.modoEntrega} · {p.metodoPago}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatoMoneda(p.total)}</p>
                  <Badge
                    variant={
                      p.estadoPago === "pagado" ? "success-light" : "warning-light"
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
              <div className="flex flex-wrap gap-2">
                <Select
                  value={p.estado}
                  disabled={busyId === p.id}
                  onValueChange={(estado) => {
                    if (estado) patch(p.id, { estado });
                  }}
                >
                  <SelectTrigger className="h-11 min-h-[var(--tap)] w-[11rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {p.estadoPago === "pendiente" &&
                  p.metodoPago === "transferencia" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === p.id}
                      onClick={() => patch(p.id, { estadoPago: "pagado" })}
                    >
                      Marcar pagado
                    </Button>
                  )}
              </div>
              <p className="text-xs text-muted-foreground">
                Al pasar a «en producción» se descuentan insumos de la receta.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
