/**
 * Storage de fotos de producto.
 *
 * Modos (env):
 * 1. Local / volumen Railway (default): MEDIA_DIR=/data/uploads
 * 2. S3-compatible (R2/S3) si hay S3_BUCKET + S3_ENDPOINT + credenciales
 *
 * URLs públicas: PUBLIC_API_URL (o RAILWAY_PUBLIC_DOMAIN).
 * No subir secrets a git.
 */
import { createHash, createHmac, randomBytes } from "crypto";
import { existsSync, mkdirSync, promises as fs } from "fs";
import { dirname, extname, join, normalize, resolve } from "path";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type StoredMedia = {
  publicUrl: string;
  key: string;
  storage: "local" | "s3";
};

function publicApiBase(): string {
  const explicit = (process.env.PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || "").trim();
  if (railway) {
    return railway.startsWith("http")
      ? railway.replace(/\/$/, "")
      : `https://${railway}`;
  }
  return "";
}

export function mediaDir(): string {
  return (
    process.env.MEDIA_DIR ||
    process.env.UPLOAD_DIR ||
    join(process.cwd(), ".data", "uploads")
  );
}

export function s3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      (process.env.S3_ENDPOINT || process.env.R2_ENDPOINT) &&
      (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
      (process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
  );
}

export function mimeToExt(mime: string): string | null {
  return ALLOWED_MIME[mime.toLowerCase()] ?? null;
}

export function assertImageUpload(file: {
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}): { ext: string; mime: string } {
  const mime = (file.mimetype || "").toLowerCase();
  const ext = mimeToExt(mime);
  if (!ext) {
    throw new Error("Formato no permitido. Usa jpg, png o webp.");
  }
  const size = file.size ?? file.buffer?.length ?? 0;
  if (size <= 0) throw new Error("Archivo vacío.");
  if (size > MAX_BYTES) {
    throw new Error("La imagen supera 5 MB.");
  }
  return { ext, mime };
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function newObjectKey(productoId: string, ext: string): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(4).toString("hex");
  const safeId =
    productoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36) || "p";
  return `productos/${safeId}-${stamp}-${rand}${ext}`;
}

function localAbsolute(key: string): string {
  const root = resolve(mediaDir());
  const full = resolve(join(root, key));
  if (!full.startsWith(root + "/") && full !== root) {
    throw new Error("Ruta de media inválida.");
  }
  return full;
}

export function publicUrlForKey(key: string): string {
  const path = `/api/media/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const base = publicApiBase();
  return base ? `${base}${path}` : path;
}

export function localKeyFromPublicUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  try {
    const u = url.startsWith("http")
      ? new URL(url)
      : new URL(url, "http://local");
    const m = u.pathname.match(/^\/api\/media\/(.+)$/);
    if (!m) return null;
    const key = decodeURIComponent(m[1]);
    if (!key.startsWith("productos/") || key.includes("..")) return null;
    return key;
  } catch {
    return null;
  }
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function awsAmzDate(): { amzDate: string; dateStamp: string } {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function s3Creds() {
  return {
    bucket: process.env.S3_BUCKET!,
    endpoint: (
      process.env.S3_ENDPOINT ||
      process.env.R2_ENDPOINT ||
      ""
    ).replace(/\/$/, ""),
    accessKey:
      process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    secretKey:
      process.env.S3_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      "",
    region: process.env.S3_REGION || process.env.AWS_REGION || "auto",
    publicBase: (
      process.env.S3_PUBLIC_BASE_URL ||
      process.env.R2_PUBLIC_BASE_URL ||
      ""
    ).replace(/\/$/, ""),
  };
}

async function s3SignedRequest(
  method: "PUT" | "DELETE",
  key: string,
  body: Buffer | null,
  mime?: string
): Promise<Response> {
  const { bucket, endpoint, accessKey, secretKey, region } = s3Creds();
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error("S3/R2 incompleto: falta S3_ENDPOINT o credenciales.");
  }
  const host = endpoint.replace(/^https?:\/\//, "");
  const url = `https://${host}/${bucket}/${key}`;
  const { amzDate, dateStamp } = awsAmzDate();
  const payloadHash = createHash("sha256")
    .update(body ?? Buffer.alloc(0))
    .digest("hex");

  const headersList =
    method === "PUT" && mime
      ? [
          `content-type:${mime}`,
          `host:${host}`,
          `x-amz-content-sha256:${payloadHash}`,
          `x-amz-date:${amzDate}`,
        ]
      : [
          `host:${host}`,
          `x-amz-content-sha256:${payloadHash}`,
          `x-amz-date:${amzDate}`,
        ];
  const signedHeaders =
    method === "PUT" && mime
      ? "content-type;host;x-amz-content-sha256;x-amz-date"
      : "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = headersList.join("\n") + "\n";
  const canonicalRequest = [
    method,
    `/${bucket}/${key}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Host: host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: authorization,
  };
  if (method === "PUT" && mime) headers["Content-Type"] = mime;

  return fetch(url, {
    method,
    headers,
    body: body ? new Uint8Array(body) : undefined,
  });
}

async function saveLocal(key: string, buffer: Buffer): Promise<StoredMedia> {
  const full = localAbsolute(key);
  ensureDir(dirname(full));
  await fs.writeFile(full, buffer);
  return { publicUrl: publicUrlForKey(key), key, storage: "local" };
}

async function deleteLocal(key: string): Promise<void> {
  try {
    await fs.unlink(localAbsolute(key));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
  }
}

async function saveS3(
  key: string,
  buffer: Buffer,
  mime: string
): Promise<StoredMedia> {
  const { publicBase, bucket, endpoint } = s3Creds();
  const res = await s3SignedRequest("PUT", key, buffer, mime);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`S3 PUT falló (${res.status}): ${text.slice(0, 200)}`);
  }
  const host = endpoint.replace(/^https?:\/\//, "");
  const publicUrl = publicBase
    ? `${publicBase}/${key}`
    : `https://${host}/${bucket}/${key}`;
  return { publicUrl, key, storage: "s3" };
}

async function deleteS3(key: string): Promise<void> {
  try {
    await s3SignedRequest("DELETE", key, null);
  } catch {
    /* ignore */
  }
}

export async function storeProductImage(
  productoId: string,
  file: { buffer: Buffer; mimetype: string; size?: number }
): Promise<StoredMedia> {
  const { ext, mime } = assertImageUpload(file);
  const key = newObjectKey(productoId, ext);
  if (s3Configured()) {
    return saveS3(key, file.buffer, mime);
  }
  ensureDir(join(mediaDir(), "productos"));
  return saveLocal(key, file.buffer);
}

export async function deleteStoredMedia(
  publicUrl: string | null | undefined
): Promise<void> {
  if (!publicUrl) return;
  const localKey = localKeyFromPublicUrl(publicUrl);
  if (localKey) {
    await deleteLocal(localKey);
    return;
  }
  if (s3Configured()) {
    try {
      const u = new URL(publicUrl);
      const idx = u.pathname.indexOf("/productos/");
      if (idx >= 0) {
        await deleteS3(u.pathname.slice(idx + 1));
      }
    } catch {
      /* ignore */
    }
  }
}

export async function readLocalMedia(
  key: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized.startsWith("productos/") || normalized.includes("..")) {
    return null;
  }
  try {
    const buffer = await fs.readFile(localAbsolute(normalized));
    const ext = extname(normalized).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    return { buffer, mime };
  } catch {
    return null;
  }
}

/** Alias de campos foto para respuestas JSON (contrato fronts). */
export function productoFotoAliases(fotoUrl: string | null | undefined) {
  const url = fotoUrl ?? null;
  return {
    fotoUrl: url,
    foto_url: url,
    imagenUrl: url,
    imagen_url: url,
  };
}
