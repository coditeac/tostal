"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPedido, formatoMoneda, labelFecha } from "@/lib/api";
import { usePedidoEvents } from "@/lib/use-pedido-events";
import {
  ESTADO_PAGO,
  METODO_PAGO,
  MODO_ENTREGA,
} from "@/lib/labels";
import type { PedidoPublico } from "@tostal/shared/types";
import { EstadoTimeline } from "@/components/estado-timeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function PedidoView() {
  const params = useParams<{ codigo: string }>();
  const codigo = params.codigo;
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await fetchPedido(codigo);
        if (alive) {
          setPedido(data.pedido);
          setError(null);
        }
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Pedido no encontrado");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const t = window.setInterval(() => {
      if (!live) load();
    }, 15000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [codigo, live]);

  usePedidoEvents(codigo, {
    onPedido: (p) => {
      setPedido(p);
      setError(null);
      setLoading(false);
      setLive(true);
    },
    onError: () => setLive(false),
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="page-shell px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Pedido</h1>
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error || "No encontrado"}</AlertDescription>
        </Alert>
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild>
            <Link href="/seguimiento">Buscar otro código</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Volver al menú</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-5 py-8">
      <p className="font-brand text-sm tracking-[0.14em] text-miel">Tostal</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Pedido {pedido.codigo}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Hola {pedido.clienteNombre}. Para {labelFecha(pedido.fechaEntrega)} ·{" "}
        {MODO_ENTREGA[pedido.modoEntrega]}
      </p>

      {pedido.metodoPago === "stripe" && pedido.estadoPago === "pendiente" && (
        <Alert className="mt-6 border-alerta/40 bg-amber-50">
          <AlertDescription className="text-alerta">
            Pago con tarjeta (Stripe) está deshabilitado por ahora. Contacta al
            restaurante para pagar por transferencia o contra entrega.
          </AlertDescription>
        </Alert>
      )}

      {pedido.metodoPago === "stripe" && pedido.estadoPago === "pagado" && (
        <Alert className="mt-4 border-ok/30 bg-emerald-50">
          <AlertDescription className="text-ok">
            Pago con tarjeta confirmado.
          </AlertDescription>
        </Alert>
      )}

      {pedido.metodoPago === "transferencia" &&
        pedido.estadoPago === "pendiente" && (
          <Alert className="mt-4 border-alerta/40 bg-amber-50">
            <AlertDescription className="text-alerta">
              Transferencia pendiente: te confirmamos el pago cuando lo
              verifiquemos.
            </AlertDescription>
          </Alert>
        )}

      <EstadoTimeline
        estado={pedido.estado}
        modoEntrega={pedido.modoEntrega}
        entity={pedido as unknown as Record<string, unknown>}
        live={live}
        tituloCancelado="Pedido cancelado"
      />

      <p className="text-sm text-muted-foreground">
        {METODO_PAGO[pedido.metodoPago]} · {ESTADO_PAGO[pedido.estadoPago]}
      </p>

      <section className="mt-8">
        <h2 className="section-title">Detalle</h2>
        <ul className="mt-4 space-y-2.5 text-sm">
          {pedido.lineas.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <span>
                {l.cantidad}× {l.productoNombre}
              </span>
              <span className="tabular-nums">{formatoMoneda(l.subtotal)}</span>
            </li>
          ))}
        </ul>
        <Separator className="my-4" />
        <div className="text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(pedido.subtotal)}</span>
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-muted-foreground">Envío</span>
            <span className="tabular-nums">{formatoMoneda(pedido.costoEnvio)}</span>
          </div>
          <div className="mt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(pedido.total)}</span>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-2">
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Pedir otra vez</Link>
        </Button>
        <Button asChild variant="link" className="text-miel">
          <Link href="/seguimiento">Buscar otro pedido</Link>
        </Button>
      </div>
    </div>
  );
}

export default function PedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg space-y-3 px-4 py-10">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      }
    >
      <PedidoView />
    </Suspense>
  );
}
