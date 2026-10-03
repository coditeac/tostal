/** external_reference MP: solo [A-Za-z0-9_-], máx 64. */

export type MpEntidad = "pedido" | "reserva";
export type MpRefTipo = MpEntidad | "checkout";

export function buildExternalReference(
  tipo: MpEntidad,
  id: string
): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "");
  const ref = `${tipo}_${clean}`;
  return ref.slice(0, 64);
}

/** Preferencia ligada a checkout_pendiente (aún sin pedido/reserva). */
export function buildCheckoutExternalReference(checkoutId: string): string {
  const clean = checkoutId.replace(/[^A-Za-z0-9_-]/g, "");
  return `chk_${clean}`.slice(0, 64);
}

export function parseExternalReference(
  ref: string | null | undefined
): { tipo: MpRefTipo; id: string } | null {
  if (!ref) return null;
  const m = /^(pedido|reserva|chk)_(.+)$/.exec(ref.trim());
  if (!m) return null;
  const raw = m[1];
  const tipo: MpRefTipo = raw === "chk" ? "checkout" : (raw as MpEntidad);
  return { tipo, id: m[2] };
}
