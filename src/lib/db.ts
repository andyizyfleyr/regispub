import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForDb = globalThis as unknown as { __regispubDb?: PrismaClient };

function createClient() {
  // Neon : utiliser l'URL « pooled ». Le pool local reste petit pour les environnements serverless.
  const adapter = new PrismaPg({ connectionString: env.databaseUrl, max: Number(process.env.DB_POOL_MAX ?? 5) });
  return new PrismaClient({ adapter });
}

export const db = globalForDb.__regispubDb ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__regispubDb = db;

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
