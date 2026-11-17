import "server-only";
import { db } from "./db";
import { createLogger } from "./logger";

const log = createLogger("audit");

export async function audit(entry: { actorId?: string | null; action: string; entity: string; entityId?: string | null; meta?: Record<string, unknown>; ip?: string | null }) {
  try {
    await db.auditLog.create({
      data: { actorId: entry.actorId ?? null, action: entry.action, entity: entry.entity, entityId: entry.entityId ?? null, meta: (entry.meta ?? undefined) as never, ip: entry.ip ?? null },
    });
  } catch (error) {
    log.error("écriture du journal d'audit impossible", { error, action: entry.action });
  }
}
