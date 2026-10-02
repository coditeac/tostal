/** Env público Supabase — sin Nest / sin NEXT_PUBLIC_API_URL. */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL. Configúrala en Railway (tostal-cliente)."
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Configúrala en Railway (tostal-cliente)."
    );
  }
  return key;
}

/** URL pública de un path en el bucket `productos`. */
export function publicProductImageUrl(
  pathOrUrl: string | null | undefined
): string | null {
  if (!pathOrUrl) return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  try {
    const base = getSupabaseUrl();
    const clean = trimmed.replace(/^\//, "");
    if (clean.startsWith("storage/v1/object/public/")) {
      return `${base}/${clean}`;
    }
    // path relativo dentro del bucket productos
    const inBucket = clean.startsWith("productos/")
      ? clean
      : `productos/${clean}`;
    return `${base}/storage/v1/object/public/${inBucket}`;
  } catch {
    return trimmed;
  }
}
