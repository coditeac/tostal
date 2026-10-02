import type { Database } from "@/lib/supabase/database.types";

export type StaffRol = Exclude<
  Database["public"]["Enums"]["user_rol"],
  "cliente"
>;

const STAFF: StaffRol[] = ["superadmin", "admin", "cocina", "caja"];

export function isStaffRol(rol: string | null | undefined): rol is StaffRol {
  return !!rol && (STAFF as string[]).includes(rol);
}
