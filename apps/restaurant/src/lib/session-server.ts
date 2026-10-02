import { createClient } from "@/lib/supabase/server";
import { isStaffRol, type StaffRol } from "@/lib/roles";

export type { StaffRol };
export { isStaffRol };

export type SessionUser = {
  id: string;
  email: string;
  nombre: string;
  rol: StaffRol;
};

export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, nombre, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.activo || !isStaffRol(profile.rol)) return null;

  return {
    id: profile.id,
    email: profile.email || user.email || "",
    nombre: profile.nombre || profile.email?.split("@")[0] || "Staff",
    rol: profile.rol,
  };
}
