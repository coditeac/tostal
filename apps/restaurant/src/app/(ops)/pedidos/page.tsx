"use client";

import { useCallback, useEffect, useState } from "react";
import { formatoMoneda, hoyISO } from "@/lib/format";
import {
  listPedidosByFecha,
  subscribePedidosFecha,
  type PedidoUi,
} from "@/lib/data/pedidos";
import { patchEstadoPedido } from "@/app/actions/estados";
import {
  normalizarEstado,
  type EstadoFlujo,
} from "@/lib/estados";
import { EstadoAcciones } from "@/components/estado-acciones";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoUi[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const mergePedido = useCallback(
    (p: PedidoUi) => {
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPedidosByFecha(fecha);
      setPedidos(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribePedidosFecha(fecha, () => {
      setLive(true);
      void load();
    });
    return unsub;
  }, [fecha, load]);

  async function cambiarEstado(id: string, estado: EstadoFlujo) {
    setBusyId(id);
    setError(null);
    try {
      const result = await patchEstadoPedido(id, estado);
      if (!result.ok) throw new Error(result.error);
      if (result.pedido?.id) {
        mergePedido(result.pedido as unknown as PedidoUi);
      } else {
        await load();
      }
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
          Cola del día · estados en vivo
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
        <Alert variant="destructive" role="alert">
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
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <li
              key={p.id}
              className="space-y-3 border-b border-border py-4 first:border-t"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.codigo}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.clienteNombre}
                    {p.clienteEmail ? ` · ${p.clienteEmail}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.canal} · {p.modoEntrega}
                    {p.metodoPago ? ` · ${p.metodoPago}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatoMoneda(p.total)}</p>
                  <Badge
                    variant={
                      normalizarEstado(p.estado) === "entregado"
                        ? "success-light"
                        : "warning-light"
                    }
                    size="sm"
                    className="mt-1"
                  >
                    {p.estado}
                  </Badge>
                </div>
              </div>
              <p className="text-sm">
                {p.lineas
                  .map((l) => `${l.cantidad}× ${l.productoNombre}`)
                  .join(" · ")}
              </p>
              <EstadoAcciones
                estado={p.estado}
                modoEntrega={p.modoEntrega}
                busy={busyId === p.id}
                onCambiar={(estado) => void cambiarEstado(p.id, estado)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
