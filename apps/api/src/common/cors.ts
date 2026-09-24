/**
 * Orígenes permitidos para CORS (Cliente + Restaurant UI → API Nest).
 */
const DEFAULT_ORIGINS = [
  "https://tostal.cafe",
  "https://www.tostal.cafe",
  "https://app.tostal.cafe",
  "https://tostal.up.railway.app",
  "https://app-tostal.up.railway.app",
  "http://127.0.0.1:4322",
  "http://localhost:4322",
  "http://127.0.0.1:4321",
  "http://localhost:4321",
].join(",");

export function allowedOrigins(): string[] {
  return (process.env.TOSTAL_CORS_ORIGINS || DEFAULT_ORIGINS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string): boolean {
  if (!origin) return true;
  const list = allowedOrigins();
  if (list.includes(origin)) return true;
  if (
    origin.endsWith(".tostal.cafe") ||
    origin.endsWith(".up.railway.app") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1")
  ) {
    return true;
  }
  return false;
}
