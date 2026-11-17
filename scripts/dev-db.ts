// Base PostgreSQL locale sans Docker (binaire PostgreSQL embarqué) pour le développement.
// Usage : npm run db:local   → démarre Postgres sur le port 5433, applique les migrations et le jeu de données initial.
import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { applyMigrations } from "./lib/migrations";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const DB = "regispub";
const dir = path.resolve(__dirname, "../.pgdata");
const url = `postgresql://postgres:postgres@localhost:${PORT}/${DB}`;

async function main() {
  const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: PORT, persistent: true, autoRehydrateSymlinks: true, onLog: () => {}, onError: (e) => { if (process.env.DEBUG) console.error(e); } });
  if (!existsSync(path.join(dir, "PG_VERSION"))) await server.initialise();
  await server.start();
  const admin = new pg.Client({ connectionString: `postgresql://postgres:postgres@localhost:${PORT}/postgres` });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${DB}"`);
  await admin.end();

  await applyMigrations(url);
  process.env.DATABASE_URL = url;
  const { seed } = await import("../prisma/seed");
  await seed({ onlyIfEmpty: true });

  console.log(`\nPostgreSQL local prêt : ${url}\nLaissez ce processus ouvert, puis lancez « npm run dev » dans un autre terminal. Ctrl+C pour arrêter.`);
  const stop = async () => { await server.stop(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => { console.error(error); process.exit(1); });
