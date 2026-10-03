"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchReserva, formatoMoneda, labelFecha } from "@/lib/api";
import { useReservaEvents } from "@/lib/use-reserva-events";
import {
  ESTADO_ANTICIPO,
  METODO_PAGO,
  MODO_ENTREGA,
} from "@/lib/labels";
import type { ReservaPublicaSeguimiento } from "@/lib/contract";
import { EstadoTimeline } from "@/components/estado-timeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetodoPago, ModoEntrega } from "@tostal/shared/types";

function metodoLabel(m: string): string {
  return METODO_PAGO[m as MetodoPago] || m;
}

function modoLabel(m: string): string {
  return MODO_ENTREGA[m as ModoEntrega] || m;
}

function esMp(m: string) {
  return m === "mercadopago" || m === "stripe";
}

function ReservaSeguimientoView() {
  const params = useParams<{ codigo: string }>();
  const search = useSearchParams();
  const codigo = params.codigo;
  const pagoHint = search.get("pago");
  const [reserva, setReserva] = useState<ReservaPublicaSeguimiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await fetchReserva(codigo);
        if (alive) {
          setReserva(data.reserva);
          setError(null);
        }
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Reserva no encontrada");
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

  useReservaEvents(codigo, {
    onReserva: (r) => {
      setReserva(r);
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

  if (error || !reserva) {
    return (
      <div className="page-shell px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Reserva</h1>
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error || "No encontrada"}</AlertDescription>
        </Alert>
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild>
            <Link href="/seguimiento">Buscar otro código</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reservas">Volver a reservas</Link>
          </Button>
        </div>
      </div>
    );
  }

  const anticipo =
    reserva.estadoAnticipo ||
    (reserva as { estado_anticipo?: string }).estado_anticipo;

  return (
    <div className="page-shell px-5 py-8">
      <p className="font-brand text-sm tracking-[0.14em] text-miel">Tostal</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Reserva {reserva.codigo}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Hola {reserva.clienteNombre}. Para {labelFecha(reserva.fechaEntrega)} ·{" "}
        {modoLabel(reserva.modoEntrega)}
      </p>

      {pagoHint === "error" && (
        <Alert className="mt-4 border-alerta/40 bg-amber-50">
          <AlertDescription className="text-alerta">
            El anticipo en Mercado Pago no se completó. Puedes reintentar o
            pagar por transferencia.
          </AlertDescription>
        </Alert>
      )}

      {pagoHint === "ok" && anticipo === "pagado" && (
        <Alert className="mt-4 border-ok/30 bg-emerald-50">
          <AlertDescription className="text-ok">
            Anticipo confirmado con Mercado Pago.
          </AlertDescription>
        </Alert>
      )}

      {anticipo === "pendiente" && (
        <Alert className="mt-4 border-alerta/40 bg-amber-50">
          <AlertDescription className="text-alerta">
            Anticipo pendiente ({formatoMoneda(reserva.anticipoMonto)})
            {esMp(reserva.metodoPago)
              ? ". Esperamos la confirmación de Mercado Pago."
              : ". Te confirmamos cuando lo verifiquemos."}
          </AlertDescription>
        </Alert>
      )}

      {anticipo === "pagado" && !pagoHint && (
        <Alert className="mt-4 border-ok/30 bg-emerald-50">
          <AlertDescription className="text-ok">
            Anticipo pagado.
          </AlertDescription>
        </Alert>
      )}

      <EstadoTimeline
        estado={reserva.estado}
        modoEntrega={reserva.modoEntrega}
        entity={reserva as unknown as Record<string, unknown>}
        live={live}
        tituloCancelado="Reserva cancelada"
      />

      <p className="text-sm text-muted-foreground">
        {metodoLabel(reserva.metodoPago)}
        {anticipo ? ` · ${ESTADO_ANTICIPO[anticipo] || anticipo}` : ""}
      </p>

      <section className="mt-8">
        <h2 className="section-title">Detalle</h2>
        <ul className="mt-4 space-y-2.5 text-sm">
          {reserva.lineas.map((l) => (
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
            <span className="tabular-nums">{formatoMoneda(reserva.subtotal)}</span>
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-muted-foreground">Anticipo</span>
            <span className="tabular-nums">
              {formatoMoneda(reserva.anticipoMonto)}
            </span>
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-muted-foreground">Envío</span>
            <span className="tabular-nums">
              {formatoMoneda(reserva.costoEnvio)}
            </span>
          </div>
          <div className="mt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(reserva.total)}</span>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-2">
        <Button asChild variant="outline" className="w-full">
          <Link href="/reservas">Nueva reserva</Link>
        </Button>
        <Button asChild variant="link" className="text-miel">
          <Link href="/seguimiento">Buscar otro código</Link>
        </Button>
      </div>
    </div>
  );
}

export default function ReservaSeguimientoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg space-y-3 px-4 py-10">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      }
    >
      <ReservaSeguimientoView />
    </Suspense>
  );
}
