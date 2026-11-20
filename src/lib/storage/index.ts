import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { getConfig } from "@/lib/config";
import { s3Complete } from "@/lib/config/keys";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";

/** Stockage d'objets. Les fichiers ne sont jamais publics : ils sont servis par /api/files après contrôle d'accès. */
export interface StorageDriver {
  readonly id: string;
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** Envoi direct depuis le navigateur (fichiers volumineux). Absent si le pilote ne le permet pas. */
  readonly direct?: DirectAccess;
}

export interface DirectAccess {
  /** URL signée, valable `expires` secondes, acceptant un PUT du fichier. */
  presignPut(key: string, expires: number): Promise<string>;
  /** URL signée de lecture, avec le type et le nom de fichier imposés par le serveur. */
  presignGet(key: string, expires: number, opts: { contentType: string; disposition: string }): Promise<string>;
  /** Premiers octets de l'objet et sa taille totale, ou null s'il n'existe pas. */
  head(key: string, bytes: number): Promise<{ head: Uint8Array; size: number } | null>;
}

/** Fichiers au-delà de cette taille : envoi et lecture directs (les fonctions serverless plafonnent les corps à 4,5 Mo). */
export const DIRECT_THRESHOLD_BYTES = 4 * 1024 * 1024;

function assertSafeKey(key: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.includes("..")) throw new Error("Clé de stockage invalide");
}

class LocalDriver implements StorageDriver {
  readonly id = "local";
  constructor(private readonly root: string) {}
  private file(key: string) { assertSafeKey(key); return path.join(this.root, key); }
  async put(key: string, data: Uint8Array) {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }
  async get(key: string) {
    try { return new Uint8Array(await readFile(this.file(key))); } catch { return null; }
  }
  async delete(key: string) { await rm(this.file(key), { force: true }); }
}

/** Compatible S3 (AWS S3, Cloudflare R2, MinIO, Backblaze B2…) via des requêtes signées SigV4. */
class S3Driver implements StorageDriver {
  readonly id = "s3";
  private readonly client: AwsClient;
  constructor(private readonly cfg: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string }) {
    this.client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, service: "s3" });
  }
  private url(key: string) { assertSafeKey(key); return `${this.cfg.endpoint}/${this.cfg.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`; }
  async put(key: string, data: Uint8Array, contentType: string) {
    // L'envoi passe par une adresse signée et un `fetch` direct avec le tableau d'octets : la taille est ainsi annoncée
    // (Content-Length). Confié à `client.fetch`, le corps devient un flux dans Next.js et part sans longueur,
    // ce que Cloudflare R2 refuse (HTTP 411).
    const res = await fetch(await this.presign("PUT", key, 300), { method: "PUT", body: data as BodyInit, headers: { "Content-Type": contentType }, cache: "no-store" });
    if (!res.ok) throw new Error(`Stockage S3 : envoi refusé (HTTP ${res.status})`);
  }
  async get(key: string) {
    const res = await this.client.fetch(this.url(key));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Stockage S3 : lecture refusée (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  async delete(key: string) {
    const res = await this.client.fetch(this.url(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`Stockage S3 : suppression refusée (HTTP ${res.status})`);
  }

  private async presign(method: "GET" | "PUT", key: string, expires: number, query: Record<string, string> = {}) {
    const url = new URL(this.url(key));
    url.searchParams.set("X-Amz-Expires", String(Math.min(Math.max(expires, 60), 3600)));
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return (await this.client.sign(new Request(url, { method }), { aws: { signQuery: true } })).url;
  }

  readonly direct: DirectAccess = {
    presignPut: (key, expires) => this.presign("PUT", key, expires),
    presignGet: (key, expires, opts) => this.presign("GET", key, expires, { "response-content-type": opts.contentType, "response-content-disposition": opts.disposition }),
    head: async (key, bytes) => {
      const res = await this.client.fetch(this.url(key), { headers: { Range: `bytes=0-${bytes - 1}` } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Stockage S3 : lecture refusée (HTTP ${res.status})`);
      const head = new Uint8Array(await res.arrayBuffer());
      const total = Number(res.headers.get("content-range")?.split("/")[1]);
      return { head, size: Number.isFinite(total) && total > 0 ? total : head.byteLength };
    },
  };
}

export async function s3Configured() {
  return s3Complete(await getConfig());
}

let cached: { signature: string; driver: StorageDriver } | null = null;

/** Stockage en vigueur. Le pilote est reconstruit dès qu'une clé change dans l'administration. */
export async function getStorage(): Promise<StorageDriver> {
  const config = await getConfig();
  const signature = config.storageDriver === "s3" ? JSON.stringify(config.s3) : "local";
  if (cached?.signature === signature) return cached.driver;
  let driver: StorageDriver;
  if (config.storageDriver === "s3") {
    if (!s3Complete(config)) throw new Error("Stockage S3 choisi mais configuration incomplète (Gestion → Paramètres → Clés et connexions)");
    driver = new S3Driver(config.s3);
  } else {
    // Sur un hébergement serverless le disque est en lecture seule : mieux vaut un message clair qu'une erreur système.
    if (env.readOnlyFs) throw new DomainError("L'envoi de fichiers n'est pas encore activé sur ce site (stockage en cours de configuration).");
    driver = new LocalDriver(path.resolve(/* turbopackIgnore: true */ process.cwd(), env.storageLocalDir));
  }
  cached = { signature, driver };
  return driver;
}

export const UPLOAD_RULES = {
  IMAGE: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 8 * 1024 * 1024 },
  VIDEO: { mimes: ["video/mp4", "video/quicktime", "video/webm"], maxBytes: 60 * 1024 * 1024 },
  DOCUMENT: { mimes: ["application/pdf", "text/csv"], maxBytes: 10 * 1024 * 1024 },
} as const;

export function kindForMime(mime: string): keyof typeof UPLOAD_RULES | null {
  for (const [kind, rule] of Object.entries(UPLOAD_RULES)) if ((rule.mimes as readonly string[]).includes(mime)) return kind as keyof typeof UPLOAD_RULES;
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "application/pdf": "pdf", "text/csv": "csv",
};
export const extensionFor = (mime: string) => EXT[mime] ?? "bin";

/** Vérifie la signature binaire du fichier : le type déclaré par le navigateur n'est pas fiable. */
export function sniffMatches(mime: string, bytes: Uint8Array) {
  const hex = (n: number) => Array.from(bytes.slice(0, n), (b) => b.toString(16).padStart(2, "0")).join("");
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  switch (mime) {
    case "image/jpeg": return hex(3) === "ffd8ff";
    case "image/png": return hex(8) === "89504e470d0a1a0a";
    case "image/webp": return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "application/pdf": return ascii(0, 5) === "%PDF-";
    case "video/mp4":
    case "video/quicktime": return ascii(4, 8) === "ftyp" || ascii(4, 8) === "moov" || ascii(4, 8) === "wide" || ascii(4, 8) === "mdat";
    case "video/webm": return hex(4) === "1a45dfa3";
    case "text/csv": return !bytes.slice(0, 512).includes(0);
    default: return false;
  }
}
