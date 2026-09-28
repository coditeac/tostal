/** Roles de staff en Restaurant / API. */
export type StaffRol = "superadmin" | "admin" | "cocina" | "caja";

export const STAFF_ROLES: StaffRol[] = [
  "superadmin",
  "admin",
  "cocina",
  "caja",
];

/** Acceso total al panel (crear usuarios, config, catálogo, etc.). */
export function isAdminLike(rol: string | null | undefined): boolean {
  return rol === "superadmin" || rol === "admin";
}

export function canManageUsers(rol: string | null | undefined): boolean {
  return isAdminLike(rol);
}
