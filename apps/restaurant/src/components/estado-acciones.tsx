"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  className?: string;
};

/**
 * Estado actual + siguiente paso obvio (chip primario marca).
 * Mobile-first: fila wrap, tap targets ≥ 44px.
 */
export function EstadoAcciones({
  estado,
  modoEntrega,
  busy,
  onCambiar,
  className,
}: Props) {
  const acciones = accionesDesdeEstado(estado, modoEntrega);
  const primaria = acciones.find((a) => a.primaria);
  const secundarias = acciones.filter((a) => !a.primaria);
  const terminal = esEstadoTerminal(estado);

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
            onClick={() => onCambiar(primaria.estado)}
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
            onClick={() => onCambiar(a.estado)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
