"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  confirmarCheckoutMetodoAlternativo,
  getCheckoutPendientePublico,
  reintentarCheckoutMercadoPago,
} from "@/app/actions/mercadopago";
import { formatoMoneda } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

type CheckoutInfo = {
  id: string;
  tipo: "pedido" | "reserva";
  estado: string;
  montoCentavos: number;
  codigo: string | null;
  errorMsg: string | null;
};

function CheckoutView() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = params.id;
  const pagoHint = search.get("pago");
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await getCheckoutPendientePublico(id);
      if (!alive) return;
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setCheckout(res.checkout);
      if (res.checkout.estado === "convertido" && res.checkout.codigo) {
        const path =
          res.checkout.tipo === "pedido"
            ? `/pedido/${res.checkout.codigo}?pago=ok`
            : `/reserva/${res.checkout.codigo}?pago=ok`;
        router.replace(path);
        return;
      }
      setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [id, router]);

  function reintentarMp() {
    startTransition(async () => {
      setError(null);
      const res = await reintentarCheckoutMercadoPago(id);
      if (!res.ok) {
        setError(res.error || "No se pudo reintentar el pago");
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res.redirectPath) {
        router.push(res.redirectPath);
      }
    });
  }

  function alternativo(metodo: "transferencia" | "contra_entrega") {
    startTransition(async () => {
      setError(null);
      const res = await confirmarCheckoutMetodoAlternativo({
        checkoutId: id,
        metodoPago: metodo,
      });
      if (!res.ok) {
        setError(res.error || "No se pudo confirmar");
        return;
      }
      if (res.redirectPath) router.push(res.redirectPath);
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="page-shell px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Pago</h1>
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error || "Checkout no encontrado"}</AlertDescription>
        </Alert>
        <Button asChild className="mt-5">
          <Link href="/">Volver al menú</Link>
        </Button>
      </div>
    );
  }

  const esReserva = checkout.tipo === "reserva";
  const fallo =
    pagoHint === "error" ||
    checkout.estado === "rechazado" ||
    Boolean(checkout.errorMsg);
  const pendienteMp =
    pagoHint === "pending" ||
    (checkout.estado === "pendiente" && pagoHint !== "error");

  return (
    <div className="page-shell px-5 py-8">
      <p className="font-brand text-sm tracking-[0.14em] text-miel">Tostal</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {esReserva ? "Anticipo de reserva" : "Pago del pedido"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Monto: {formatoMoneda(checkout.montoCentavos)}. Aún no hay{" "}
        {esReserva ? "reserva" : "pedido"} creado hasta que el pago con Mercado
        Pago se apruebe.
      </p>

      {fallo && (
        <Alert className="mt-6 border-alerta/40 bg-amber-50">
          <AlertDescription className="text-alerta">
            El pago en Mercado Pago no se completó
            {checkout.errorMsg ? ` (${checkout.errorMsg})` : ""}. Puedes
            reintentar con tarjeta o elegir otro método. No se creó{" "}
            {esReserva ? "ninguna reserva" : "ningún pedido"}.
          </AlertDescription>
        </Alert>
      )}

      {pendienteMp && !fallo && (
        <Alert className="mt-6 border-alerta/40 bg-amber-50">
          <AlertDescription className="text-alerta">
            Estamos esperando la confirmación de Mercado Pago. Si ya pagaste,
            espera unos segundos y actualiza. Si cancelaste, reintenta o cambia
            de método.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-8 flex flex-col gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => reintentarMp()}
        >
          {pending ? <Spinner className="mr-2" /> : null}
          Reintentar Mercado Pago
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => alternativo("transferencia")}
        >
          Pagar por transferencia
        </Button>
        {!esReserva && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => alternativo("contra_entrega")}
          >
            Pagar contra entrega
          </Button>
        )}
        <Button asChild variant="link" className="text-miel">
          <Link href={esReserva ? "/reservas" : "/carrito"}>
            Volver {esReserva ? "a reservas" : "al carrito"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg space-y-3 px-4 py-10">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      }
    >
      <CheckoutView />
    </Suspense>
  );
}
