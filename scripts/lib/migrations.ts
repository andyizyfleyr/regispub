// Applique les migrations SQL de prisma/migrations sans le moteur binaire de Prisma.
// La table _prisma_migrations est tenue au même format que `prisma migrate deploy` : les deux outils sont interchangeables.
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations");

export async function applyMigrations(connectionString: string, log: (msg: string) => void = console.log) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT, "rolled_back_at" TIMESTAMPTZ, "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
    const applied = new Set((await client.query(`SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`)).rows.map((r) => r.migration_name as string));
    const names = readdirSync(MIGRATIONS_DIR).filter((n) => existsSync(path.join(MIGRATIONS_DIR, n, "migration.sql"))).sort();
    let count = 0;
    for (const name of names) {
      if (applied.has(name)) continue;
      const sql = readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
      const id = randomUUID();
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count") VALUES ($1, $2, $3, now(), 1)`, [id, createHash("sha256").update(sql).digest("hex"), name]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${name} en échec : ${(error as Error).message}`);
      }
      log(`✓ migration appliquée : ${name}`);
      count++;
    }
    if (!count) log("Base à jour : aucune migration à appliquer.");
    return count;
  } finally {
    await client.end();
  }
}
