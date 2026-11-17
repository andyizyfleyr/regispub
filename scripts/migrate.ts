import "dotenv/config";
import { applyMigrations } from "./lib/migrations";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL (ou DIRECT_URL) est requis."); process.exit(1); }
applyMigrations(url).catch((error) => { console.error(error.message); process.exit(1); });
