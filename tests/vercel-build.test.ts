import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Vercel production migration connection", () => {
  it.each([
    ["", /DIRECT_URL is required/],
    ["postgresql://postgres:password@pooler.example.com:6543/postgres", /not the transaction pooler/],
    ["https://example.com", /PostgreSQL session\/direct connection/],
  ])("stops before migrations or build for invalid DIRECT_URL (%s)", (directUrl, message) => {
    const result = spawnSync(process.execPath, ["scripts/vercel-build.mjs"], {
      encoding: "utf8",
      env: { ...process.env, VERCEL_ENV: "production", DIRECT_URL: directUrl },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(result.stdout).not.toMatch(/Generated Prisma Client|migrations found|Next\.js/);
  });
});
