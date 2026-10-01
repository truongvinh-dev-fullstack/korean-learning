import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";

export function testDatabaseUrl() {
  const developmentUrl = process.env.DATABASE_URL;
  if (!developmentUrl) throw new Error("DATABASE_URL is required to derive the isolated test database.");
  if (process.env.KOREAN_TEST_DATABASE_ACTIVE === "1") {
    if (!/^\/[a-zA-Z0-9_]+_test$/.test(new URL(developmentUrl).pathname)) {
      throw new Error("The active test database name must end in _test.");
    }
    return developmentUrl;
  }
  const development = new URL(developmentUrl);
  const test = process.env.TEST_DATABASE_URL
    ? new URL(process.env.TEST_DATABASE_URL)
    : new URL(developmentUrl);
  if (!process.env.TEST_DATABASE_URL) test.pathname = `${development.pathname}_test`;
  if (test.protocol !== "postgresql:" && test.protocol !== "postgres:") throw new Error("Tests require PostgreSQL.");
  if (test.href === development.href || !/^\/[a-zA-Z0-9_]+_test$/.test(test.pathname)) {
    throw new Error("The test database must be distinct from development and end in _test.");
  }
  return test.href;
}

export async function prepareTestDatabase() {
  const url = testDatabaseUrl();
  const admin = new URL(url);
  const databaseName = admin.pathname.slice(1);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.href });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }
  // A configured production DIRECT_URL must never reach test migrations.
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("pnpm exec tsx prisma/seed.ts", { env, stdio: "inherit" });
}
