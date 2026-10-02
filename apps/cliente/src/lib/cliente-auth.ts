"use client";

import { useCallback, useEffect, useState } from "react";
import { createClienteBrowserClient } from "@/lib/supabase/client";

export type ClienteUser = {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  /** Siempre `cliente` en esta app. Staff/superadmin usan Restaurant. */
  rol: "cliente";
};

/**
 * Auth Supabase. Signup fuerza metadata sin escalar rol:
 * `profiles.rol` queda `cliente` (default trigger).
 * Superadmin del Project: cocina@tostal.cafe (solo Restaurant).
 */
export function useClienteSession() {
  const [user, setUser] = useState<ClienteUser | null>(null);
  const [loading, setLoading] = useState(true);

  const mapUser = useCallback(async (): Promise<ClienteUser | null> => {
    const sb = createClienteBrowserClient();
    const {
      data: { user: authUser },
    } = await sb.auth.getUser();
    if (!authUser) return null;

    const { data: profile } = await sb
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", authUser.id)
      .maybeSingle();

    // Solo compradores en esta app. Staff debe ir a app.tostal.cafe.
    if (profile && profile.rol !== "cliente") {
      return null;
    }

    return {
      id: authUser.id,
      email: profile?.email || authUser.email || "",
      nombre:
        profile?.nombre ||
        (authUser.user_metadata?.nombre as string) ||
        (authUser.email || "").split("@")[0],
      telefono: (authUser.user_metadata?.telefono as string) || null,
      rol: "cliente",
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await mapUser());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [mapUser]);

  useEffect(() => {
    void refresh();
    const sb = createClienteBrowserClient();
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  async function login(email: string, password: string) {
    const sb = createClienteBrowserClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message || "No se pudo iniciar sesión");

    const mapped = await mapUser();
    if (!mapped) {
      await sb.auth.signOut();
      throw new Error(
        "Esta cuenta es de personal. Entra en app.tostal.cafe."
      );
    }
    setUser(mapped);
    return mapped;
  }

  async function register(input: {
    email: string;
    password: string;
    nombre: string;
    telefono?: string;
  }) {
    const sb = createClienteBrowserClient();
    // Nunca enviar rol en metadata: el trigger default es `cliente`.
    // Superadmin (cocina@tostal.cafe) se asigna solo en Dashboard/Restaurant.
    const { data, error } = await sb.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          nombre: input.nombre,
          telefono: input.telefono || null,
        },
      },
    });
    if (error) throw new Error(error.message || "No se pudo crear la cuenta");
    if (!data.user) throw new Error("Revisa tu correo para confirmar la cuenta");

    // Trigger handle_new_user ya pone profiles.rol = cliente (default).
    // No enviamos `rol` en metadata ni lo actualizamos aquí (RLS bloquea auto-escalada).
    if (data.session) {
      await sb
        .from("profiles")
        .update({ nombre: input.nombre })
        .eq("id", data.user.id);
    }

    const mapped = await mapUser();
    if (!mapped) {
      setUser(null);
      return {
        id: data.user.id,
        email: input.email,
        nombre: input.nombre,
        telefono: input.telefono || null,
        rol: "cliente" as const,
      };
    }
    setUser(mapped);
    return mapped;
  }

  async function logout() {
    const sb = createClienteBrowserClient();
    await sb.auth.signOut();
    setUser(null);
  }

  return { user, loading, login, register, logout, refresh };
}
