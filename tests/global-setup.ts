// Démarre un PostgreSQL embarqué (sans Docker) pour les tests d'intégration, applique les migrations et le jeu de données.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { applyMigrations } from "../scripts/lib/migrations";

export const TEST_DB_PORT = Number(process.env.TEST_DB_PORT ?? 5544);
export const TEST_DB_URL = `postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/regispub_test`;

export default async function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), "regispub-test-"));
  const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: TEST_DB_PORT, persistent: false, autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} });
  await server.initialise();
  await server.start();
  const admin = new pg.Client({ connectionString: `postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/postgres` });
  await admin.connect();
  await admin.query('CREATE DATABASE "regispub_test"');
  await admin.end();
  await applyMigrations(TEST_DB_URL, () => {});
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.SEED_DEMO = "true";
  process.env.SEED_ADMIN_EMAIL = "admin@regispub.local";
  process.env.SEED_ADMIN_PASSWORD = "Admin1234!";
  const original = console.log;
  console.log = () => {};
  try {
    const { seed } = await import("../prisma/seed");
    await seed();
  } finally { console.log = original; }
  return async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
