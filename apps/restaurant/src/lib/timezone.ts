/** Zona horaria operativa de Tostal (Ciudad de México). */
export const TZ_CDMX = "America/Mexico_City";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function partsInCdmx(date: Date): Record<string, string> {
  const entries = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CDMX,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .filter((p) => p.type !== "literal")
    .map((p) => [p.type, p.value] as const);
  return Object.fromEntries(entries);
}

/** Fecha de hoy YYYY-MM-DD en CDMX. */
export function hoyISO(): string {
  const p = partsInCdmx(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

/** Suma días a fecha civil YYYY-MM-DD (sin drift UTC). */
export function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + dias);
  return utc.toISOString().slice(0, 10);
}

/** Etiqueta corta de fecha (calendario civil CDMX). */
export function labelFecha(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString("es-MX", {
    timeZone: TZ_CDMX,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * ISO UTC (deadline_pedido) → HH:mm en CDMX para `<input type="time">`.
 * Contrato: la UI edita hora CDMX; la API interpreta HH:mm en America/Mexico_City.
 */
export function isoToHoraCdmx(
  iso: string | null | undefined,
  fallback = "18:00"
): string {
  if (!iso) return fallback;
  // Ya viene HH:mm
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(iso)) return iso.slice(0, 5);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const p = partsInCdmx(d);
  return `${p.hour}:${p.minute}`;
}

/** @deprecated Preferir isoToHoraCdmx + input type=time */
export function isoToDatetimeLocalCdmx(
  iso: string | null | undefined,
  fechaFallback: string
): string {
  return `${fechaFallback}T${isoToHoraCdmx(iso)}`;
}

export function formatHoraCdmx(iso: string): string {
  return isoToHoraCdmx(iso, "—");
}

export { pad };
