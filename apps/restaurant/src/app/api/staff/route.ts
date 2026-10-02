import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { StaffRol } from "@/lib/roles";

export const dynamic = "force-dynamic";

const CREABLE: StaffRol[] = ["admin", "cocina", "caja"];

type Body = {
  email?: string;
  nombre?: string;
  password?: string;
  rol?: string;
};

/**
 * Alta de staff server-side con service_role.
 * Evita: (1) escalada vía metadata en signup, (2) que signUp del browser robe la sesión admin.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.rol !== "superadmin" && session.rol !== "admin")) {
    return NextResponse.json(
      { error: "Solo admin/superadmin puede crear personal." },
      { status: 403 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const nombre = (body.nombre || "").trim();
  const password = body.password || "";
  const rol = body.rol as StaffRol;

  if (!email || !nombre || password.length < 8) {
    return NextResponse.json(
      { error: "Email, nombre y contraseña (mín. 8) son obligatorios." },
      { status: 400 }
    );
  }
  if (!CREABLE.includes(rol)) {
    return NextResponse.json(
      { error: "Rol no permitido. Usa admin, cocina o caja." },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor (Railway). No se puede crear personal.",
      },
      { status: 503 }
    );
  }

  // Doble check con el cliente de sesión (RLS) por si el cookie se manipula.
  const supabase = await createClient();
  const { data: actor } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", session.id)
    .maybeSingle();
  if (!actor || (actor.rol !== "superadmin" && actor.rol !== "admin")) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message || "No se pudo crear el usuario Auth" },
      { status: 400 }
    );
  }

  const id = created.user.id;
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id,
        email,
        nombre,
        rol,
        activo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileErr) {
    // Best-effort cleanup si el profile falla
    await admin.auth.admin.deleteUser(id);
    return NextResponse.json(
      { error: profileErr.message || "No se pudo asignar el rol" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id, email, nombre, rol });
}
