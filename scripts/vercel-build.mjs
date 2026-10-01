import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Next.js loads .env.production* itself; do not preload local development values.
process.env.NODE_ENV = "production";

function run(entry, args) {
  const result = spawnSync(process.execPath, [require.resolve(entry), ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Preview builds must never apply migrations to the production database.
if (process.env.VERCEL_ENV === "production") {
  const directUrl = process.env.DIRECT_URL?.trim();
  if (!directUrl) {
    throw new Error("DIRECT_URL is required for Vercel Production migrations. Use the Supabase Session pooler (5432).");
  }
  const url = new URL(directUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.port === "6543") {
    throw new Error("DIRECT_URL must use a PostgreSQL session/direct connection, not the transaction pooler (6543).");
  }
}

run("prisma/build/index.js", ["generate"]);
if (process.env.VERCEL_ENV === "production") {
  run("prisma/build/index.js", ["migrate", "deploy"]);
}
run("next/dist/bin/next", ["build"]);
