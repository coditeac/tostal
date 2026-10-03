/** external_reference MP: solo [A-Za-z0-9_-], máx 64. */

export type MpEntidad = "pedido" | "reserva";

export function buildExternalReference(
  tipo: MpEntidad,
  id: string
): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "");
  const ref = `${tipo}_${clean}`;
  return ref.slice(0, 64);
}

export function parseExternalReference(
  ref: string | null | undefined
): { tipo: MpEntidad; id: string } | null {
  if (!ref) return null;
  const m = /^(pedido|reserva)_(.+)$/.exec(ref.trim());
  if (!m) return null;
  return { tipo: m[1] as MpEntidad, id: m[2] };
}
