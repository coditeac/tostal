"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchPedido, formatoMoneda, labelFecha } from "@/lib/api";
import { usePedidoEvents } from "@/lib/use-pedido-events";
import {
  ESTADO_PAGO,
  ESTADO_PEDIDO,
  METODO_PAGO,
  MODO_ENTREGA,
  PASOS_PEDIDO,
} from "@/lib/labels";
import type { PedidoPublico } from "@tostal/shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";

function PedidoView() {
  const params = useParams<{ codigo: string }>();
  const search = useSearchParams();
  const codigo = params.codigo;
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const stripeHint = search.get("pago") === "stripe";

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

  const idx = PASOS_PEDIDO.indexOf(pedido.estado);
  const activeStep = idx < 0 ? 1 : idx + 1;
  const cancelado = pedido.estado === "cancelado";

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
      {live && (
        <Badge variant="success-light" size="lg" className="mt-2">
          ● Seguimiento en vivo
        </Badge>
      )}

      {stripeHint && pedido.metodoPago === "stripe" && (
        <Alert className="mt-4 border-ok/30 bg-emerald-50">
          <AlertDescription className="text-ok">
            {pedido.estadoPago === "pagado"
              ? "Pago con tarjeta simulado correctamente (modo demo sin clave Stripe)."
              : "Pago con tarjeta registrado; pendiente de confirmación."}
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

      <Frame className="mt-6 overflow-hidden rounded-[1rem] border border-border bg-white shadow-none">
        <FramePanel className="border-0 p-4">
          {cancelado ? (
            <p className="font-semibold text-error">Pedido cancelado</p>
          ) : (
            <>
              <p className="text-2xl font-semibold leading-tight">
                {ESTADO_PEDIDO[pedido.estado]}
              </p>
              <Stepper
                value={activeStep}
                orientation="horizontal"
                className="mt-5"
              >
                <StepperNav>
                  {PASOS_PEDIDO.map((paso, i) => (
                    <StepperItem
                      key={paso}
                      step={i + 1}
                      className="relative flex-1 items-start"
                    >
                      <StepperTrigger className="flex w-full flex-col items-center gap-1.5 rounded-md p-0">
                        <StepperIndicator className="size-3 data-[state=completed]:bg-ok data-[state=active]:bg-primary data-[state=active]:ring-4 data-[state=active]:ring-primary/20" />
                        <StepperTitle className="max-w-[4.5rem] text-center text-[10px] font-medium leading-tight">
                          {ESTADO_PEDIDO[paso]}
                        </StepperTitle>
                      </StepperTrigger>
                      {i < PASOS_PEDIDO.length - 1 && (
                        <StepperSeparator className="absolute top-1.5 right-0 left-[calc(50%+0.5rem)] m-0! w-[calc(100%-1rem)] group-data-[state=completed]/stepper-item:bg-ok" />
                      )}
                    </StepperItem>
                  ))}
                </StepperNav>
              </Stepper>
            </>
          )}
          <p className="mt-5 text-sm text-muted-foreground">
            {METODO_PAGO[pedido.metodoPago]} · {ESTADO_PAGO[pedido.estadoPago]}
          </p>
        </FramePanel>
      </Frame>

      <Frame className="mt-4 overflow-hidden rounded-[1rem] border border-border bg-white shadow-none">
        <FrameHeader className="border-0 px-4 pb-0 pt-4">
          <FrameTitle className="text-base font-semibold">Detalle</FrameTitle>
        </FrameHeader>
        <FramePanel className="border-0 p-4 pt-2">
          <ul className="space-y-2 text-sm">
            {pedido.lineas.map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span>
                  {l.cantidad}× {l.productoNombre}
                </span>
                <span>{formatoMoneda(l.subtotal)}</span>
              </li>
            ))}
          </ul>
          <Separator className="my-3" />
          <div className="text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatoMoneda(pedido.subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Envío</span>
              <span>{formatoMoneda(pedido.costoEnvio)}</span>
            </div>
            <div className="mt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatoMoneda(pedido.total)}</span>
            </div>
          </div>
        </FramePanel>
      </Frame>

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
