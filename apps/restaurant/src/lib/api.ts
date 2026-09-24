/**
 * Cliente HTTP hacia apps/api (NestJS).
 * En producción: NEXT_PUBLIC_API_URL=https://api.tostal.cafe
 * Local: http://127.0.0.1:4331
 */
export function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_TOSTAL_API_URL ||
    "http://127.0.0.1:4331"
  ).replace(/\/$/, "");
}

export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${getApiBase()}${path}`;
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

/** Server Components: reenvía cookie del browser a la API Nest. */
export async function apiFetchServer(
  path: string,
  cookieHeader?: string,
  init?: RequestInit
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${getApiBase()}${path}`;
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}
