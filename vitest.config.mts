import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") } },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: `postgresql://postgres:postgres@localhost:${process.env.TEST_DB_PORT ?? 5544}/regispub_test`,
      APP_SECRET: "secret-de-test-0123456789abcdef0123456789abcdef",
      APP_URL: "http://localhost:3000",
      PAYMENT_PROVIDER: "sandbox",
      STORAGE_DRIVER: "local",
      LOG_LEVEL: "error",
    },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
