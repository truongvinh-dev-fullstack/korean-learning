import { defineConfig } from "vitest/config";
import path from "path";
import { testDatabaseUrl } from "./scripts/test-database";

process.env.DATABASE_URL = testDatabaseUrl();
process.env.KOREAN_TEST_DATABASE_ACTIVE = "1";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    globalSetup: ["./tests/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
