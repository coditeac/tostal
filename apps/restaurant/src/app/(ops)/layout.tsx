import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

/** Layout autenticado para rutas ops (/inventario, /compras, …) */
export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  return <AppShell userNombre={user.nombre}>{children}</AppShell>;
}
