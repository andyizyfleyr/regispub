import "dotenv/config";
import { defineConfig } from "prisma/config";

// Sur Neon : DATABASE_URL = URL « pooled » (application), DIRECT_URL = URL directe (migrations).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/regispub",
  },
});
