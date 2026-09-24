"use client";

import { useCallback, useEffect, useState } from "react";
import { CLIENTE_AUTH_API } from "@tostal/shared/api-public";
import { getApiBase } from "./api";

export type ClienteUser = {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
};

async function clienteFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Error de cuenta");
  }
  return data as T;
}

export function useClienteSession() {
  const [user, setUser] = useState<ClienteUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await clienteFetch<{ user: ClienteUser | null }>(
        CLIENTE_AUTH_API.me
      );
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function login(email: string, password: string) {
    const data = await clienteFetch<{ user: ClienteUser }>(
      CLIENTE_AUTH_API.login,
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    setUser(data.user);
    return data.user;
  }

  async function register(input: {
    email: string;
    password: string;
    nombre: string;
    telefono?: string;
  }) {
    const data = await clienteFetch<{ user: ClienteUser }>(
      CLIENTE_AUTH_API.register,
      { method: "POST", body: JSON.stringify(input) }
    );
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await clienteFetch(CLIENTE_AUTH_API.logout, { method: "POST" });
    setUser(null);
  }

  return { user, loading, login, register, logout, refresh };
}
