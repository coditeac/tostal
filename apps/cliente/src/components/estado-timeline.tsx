"use client";

import {
  ESTADO_SEGUIMIENTO_LABEL,
  hintEstado,
  indicePaso,
  labelEstado,
  leerHistorial,
  normalizarEstado,
  pasosTimeline,
  statusPaso,
  type HistorialItem,
  type ModoEntregaSeguimiento,
} from "@/lib/estados";

type Props = {
  estado: string;
  modoEntrega?: ModoEntregaSeguimiento;
  /** Entidad cruda por si trae estado_historial */
  entity?: Record<string, unknown> | null;
  live?: boolean;
  tituloCancelado?: string;
};

function formatAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function EstadoTimeline({
  estado,
  modoEntrega = "retiro",
  entity,
  live,
  tituloCancelado = "Cancelado",
}: Props) {
  const normalizado = normalizarEstado(estado);
  const cancelado = normalizado === "cancelado";
  const pasos = pasosTimeline(modoEntrega);
  const idx = indicePaso(estado, pasos);
  const historial: HistorialItem[] = leerHistorial(entity);

  return (
    <section className="mt-8 border-y border-border py-6">
      {cancelado ? (
        <p className="font-semibold text-error">{tituloCancelado}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-2xl font-semibold leading-tight tracking-tight">
              {labelEstado(estado)}
            </p>
            {live && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--tostal-ok)_14%,white)] px-2.5 py-1 text-[11px] font-semibold text-ok"
                role="status"
                aria-live="polite"
              >
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
                </span>
                En vivo
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {hintEstado(estado)}
          </p>

          <ol
            className="status-track mt-6"
            aria-label="Progreso del pedido"
          >
            {pasos.map((paso, i) => {
              const st = statusPaso(i, idx, cancelado);
              const last = i === pasos.length - 1;
              const label = ESTADO_SEGUIMIENTO_LABEL[paso];
              const estadoPaso =
                st === "current"
                  ? `Actual: ${label}`
                  : st === "done"
                    ? `Completado: ${label}`
                    : `Pendiente: ${label}`;
              return (
                <li key={paso} className="status-step">
                  {!last && (
                    <span
                      className={`status-line ${
                        st === "done" || st === "current" ? "status-line-done" : ""
                      }`}
                      aria-hidden
                    />
                  )}
                  <span
                    className={`status-dot ${
                      st === "done"
                        ? "status-dot-done"
                        : st === "current"
                          ? "status-dot-current"
                          : ""
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`max-w-[4.75rem] text-[10px] leading-tight ${
                      st === "current" || st === "done"
                        ? "font-semibold text-cacao"
                        : "text-muted-foreground"
                    }`}
                    aria-current={st === "current" ? "step" : undefined}
                  >
                    <span className="sr-only">{estadoPaso}</span>
                    <span aria-hidden>{label}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {historial.length > 0 && (
        <ol className="mt-6 space-y-3 border-t border-border pt-5">
          {historial.map((h, i) => {
            const when = formatAt(h.at);
            return (
              <li key={`${h.estado}-${h.at ?? i}`} className="flex gap-3 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    i === 0 ? "bg-miel" : "bg-border"
                  }`}
                />
                <div>
                  <p className="font-medium text-cacao">{labelEstado(h.estado)}</p>
                  {when && (
                    <p className="text-xs text-muted-foreground">{when}</p>
                  )}
                  {h.nota && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{h.nota}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
