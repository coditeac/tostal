/**
 * Traduce errores de Supabase Auth a mensajes claros en español.
 * Evita filtrar jerga técnica al cliente.
 */
export function mensajeAuthError(raw: unknown, fallback: string): string {
  const msg =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : fallback;
  const lower = msg.toLowerCase();

  if (
    /invalid login credentials|invalid_credentials|email or password/i.test(
      lower
    )
  ) {
    return "Email o contraseña incorrectos. Revisa e inténtalo de nuevo.";
  }
  if (/email not confirmed|confirm.*email|not.*confirmed/i.test(lower)) {
    return "Confirma tu email antes de entrar. Revisa tu bandeja o spam.";
  }
  if (/user already registered|already.*(registered|exists)/i.test(lower)) {
    return "Ya existe una cuenta con ese email. Inicia sesión.";
  }
  if (/password.*(?:weak|short|at least|characters)/i.test(lower)) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (/rate limit|too many requests|over_request/i.test(lower)) {
    return "Demasiados intentos. Espera un momento e inténtalo otra vez.";
  }
  if (/network|fetch failed|failed to fetch/i.test(lower)) {
    return "No hay conexión. Revisa tu internet e inténtalo de nuevo.";
  }
  if (/personal|staff|app\.tostal\.cafe/i.test(lower)) {
    return msg; // ya en español desde cliente-auth
  }
  // Si ya viene en español razonable, úsalo; si no, fallback
  if (/[áéíóúñ¿¡]|cuenta|sesión|correo|contraseña/i.test(msg)) {
    return msg;
  }
  return fallback;
}
