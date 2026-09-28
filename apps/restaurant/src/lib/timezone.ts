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
 * ISO (UTC) → valor para `<input type="datetime-local">` en hora CDMX.
 * El input no lleva zona; la UI lo trata siempre como CDMX.
 */
export function isoToDatetimeLocalCdmx(
  iso: string | null | undefined,
  fechaFallback: string
): string {
  if (!iso) return `${fechaFallback}T18:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `${fechaFallback}T18:00`;
  const p = partsInCdmx(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Valor `datetime-local` interpretado en CDMX → ISO UTC para la API.
 */
export function datetimeLocalCdmxToIso(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error("Hora inválida (usa formato CDMX).");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);

  // CDMX sin DST desde 2022 ≈ UTC-6; afinamos con Intl por si cambia.
  let utcMs = Date.UTC(y, mo - 1, d, h + 6, mi, 0);
  for (let i = 0; i < 4; i++) {
    const shown = partsInCdmx(new Date(utcMs));
    const got = Date.UTC(
      Number(shown.year),
      Number(shown.month) - 1,
      Number(shown.day),
      Number(shown.hour),
      Number(shown.minute),
      0
    );
    const want = Date.UTC(y, mo - 1, d, h, mi, 0);
    const delta = want - got;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs).toISOString();
}

/** Default 18:00 CDMX del día indicado, como ISO UTC. */
export function defaultHoraLimiteIsoCdmx(fecha: string): string {
  return datetimeLocalCdmxToIso(`${fecha}T18:00`);
}

export function formatHoraCdmx(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-MX", {
    timeZone: TZ_CDMX,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export { pad };
