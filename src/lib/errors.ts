/** Erreur métier dont le message est destiné à l'utilisateur (affichable tel quel). */
export class DomainError extends Error {}

/** Référence courte d'une panne technique, affichable à l'utilisateur : dit où l'envoi a échoué sans rien révéler de sensible. */
export function failureCode(error: unknown): string {
  const e = error as (Error & { code?: string }) | null;
  const message = e?.message ?? "";
  const http = /HTTP (\d{3})/.exec(message)?.[1];
  if (message.startsWith("Stockage S3")) return `stockage-${http ?? "x"}`;
  if (message.includes("configuration S3")) return "stockage-config";
  if (e?.name === "TypeError" && /fetch failed/i.test(message)) return "stockage-reseau";
  if (e?.name?.startsWith("Prisma") || /^P\d{4}$/.test(e?.code ?? "")) return `base-${e?.code ?? "x"}`;
  return "interne";
}
