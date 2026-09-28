/** Zona horaria operativa de Tostal (negocio en CDMX). */
export const TZ_CDMX = "America/Mexico_City";

type CdmxParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTz(date: Date, timeZone: string): CdmxParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** Fecha civil de “hoy” en CDMX (YYYY-MM-DD). */
export function hoyISO(): string {
  const p = partsInTz(new Date(), TZ_CDMX);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Suma días a una fecha civil YYYY-MM-DD (sin drift UTC). */
export function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + dias);
  return utc.toISOString().slice(0, 10);
}

/**
 * Convierte pared CDMX (fecha + HH:mm o HH:mm:ss) → Instant ISO UTC.
 * Usado para persistir `hora_limite` / `deadline_pedido`.
 */
export function cdmxLocalToUtcIso(fechaISO: string, horaHHmm: string): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(horaHHmm.trim());
  if (!match) {
    // Si ya viene ISO, normalizar
    const asDate = new Date(horaHHmm);
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();
    throw new Error(`Hora inválida: ${horaHHmm}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const [y, mo, d] = fechaISO.split("-").map(Number);

  // Partir de un UTC “naive” y corregir con el offset real de CDMX ese instante.
  let utcMs = Date.UTC(y, mo - 1, d, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const seen = partsInTz(new Date(utcMs), TZ_CDMX);
    const seenAsUtc = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
      seen.second
    );
    const desired = Date.UTC(y, mo - 1, d, hour, minute, second);
    utcMs -= seenAsUtc - desired;
  }
  return new Date(utcMs).toISOString();
}

/** ¿El instante actual (absoluto) es anterior al deadline ISO? */
export function deadlineVigente(deadlineIso: string | null | undefined): boolean {
  if (!deadlineIso) return false;
  const t = new Date(deadlineIso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() < t;
}

/** ¿Ya pasó la hora límite? */
export function deadlineVencido(deadlineIso: string | null | undefined): boolean {
  return !deadlineVigente(deadlineIso);
}

export function formatoMoneda(centavos: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
  }).format(centavos / 100);
}

/** Precio en pesos → centavos enteros */
export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}
