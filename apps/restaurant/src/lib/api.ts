/**
 * Compat shim: la UI ya no habla con Nest.
 * Preferir @/lib/supabase/client y módulos data/*.
 */
export function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://yoxsldirdgdpsabsivac.supabase.co"
  ).replace(/\/$/, "");
}

/** @deprecated */
export async function apiFetch(
  _path: string,
  _init?: RequestInit
): Promise<Response> {
  return new Response(
    JSON.stringify({
      error:
        "API Nest desconectada. Usa el cliente Supabase de la app restaurant.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
}

/** @deprecated */
export async function apiFetchServer(
  path: string,
  _cookieHeader?: string,
  init?: RequestInit
): Promise<Response> {
  return apiFetch(path, init);
}
