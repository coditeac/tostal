import { cookies } from "next/headers";
import { apiFetchServer } from "./api";

export type SessionUser = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "cocina" | "caja";
};

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  try {
    const res = await apiFetchServer("/api/auth/session", cookieHeader);
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SessionUser | null };
    return data.user || null;
  } catch {
    return null;
  }
}
