import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  ensureSeed();
  const user = await getSession();
  if (!user) redirect("/login");
  return <AppShell userNombre={user.nombre}>{children}</AppShell>;
}
