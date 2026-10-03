"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  accionesDesdeEstado,
  esEstadoTerminal,
  labelEstado,
  labelEstadoCorto,
  varianteBadgeEstado,
  type EstadoFlujo,
  type ModoEntregaUi,
} from "@/lib/estados";
import { cn } from "cn";

type Props = {
  estado: string;
  modoEntrega?: ModoEntregaUi;
  busy?: boolean;
  onCambiar: (estado: EstadoFlujo) => void;
  /** Texto en el diálogo de anulación (pedido/reserva). */
  entidadLabel?: string;
  className?: string;
};

/**
 * Estado actual + siguiente paso obvio (chip primario marca).
 * Mobile-first: fila wrap, tap targets ≥ 44px.
 * Anular pide confirmación (conserva historial/finanzas).
 */
export function EstadoAcciones({
  estado,
  modoEntrega,
  busy,
  onCambiar,
  entidadLabel = "este registro",
  className,
}: Props) {
  const [confirmAnular, setConfirmAnular] = useState(false);
  const acciones = accionesDesdeEstado(estado, modoEntrega);
  const primaria = acciones.find((a) => a.primaria);
  const secundarias = acciones.filter((a) => !a.primaria);
  const terminal = esEstadoTerminal(estado);

  function handleAccion(e: EstadoFlujo) {
    if (e === "cancelado") {
      setConfirmAnular(true);
      return;
    }
    onCambiar(e);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Estado</span>
        <Badge
          variant={varianteBadgeEstado(estado)}
          size="lg"
          radius="default"
          className="font-medium"
        >
          {labelEstado(estado)}
        </Badge>
      </div>

      {!terminal && primaria ? (
        <p className="text-xs text-muted-foreground">
          Siguiente:{" "}
          <span className="font-medium text-foreground">
            {labelEstadoCorto(primaria.estado)}
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {primaria ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={busy}
            className="min-h-[var(--tap)] min-w-[7.5rem] flex-1 sm:flex-none"
            onClick={() => handleAccion(primaria.estado)}
          >
            {busy ? "Guardando…" : primaria.label}
          </Button>
        ) : null}
        {secundarias.map((a) => (
          <Button
            key={a.estado}
            type="button"
            size="sm"
            variant={a.variante ?? "outline"}
            disabled={busy}
            className="min-h-[var(--tap)]"
            aria-label={
              a.estado === "cancelado"
                ? `Anular ${entidadLabel}`
                : a.label
            }
            onClick={() => handleAccion(a.estado)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <ConfirmDialog
        open={confirmAnular}
        onOpenChange={setConfirmAnular}
        title="¿Anular?"
        description={`Se anulará ${entidadLabel} y saldrá de la cola activa. El historial y los ingresos/gastos ya registrados se conservan.`}
        confirmLabel="Anular"
        busy={busy}
        onConfirm={async () => {
          setConfirmAnular(false);
          onCambiar("cancelado");
        }}
      />
    </div>
  );
}
