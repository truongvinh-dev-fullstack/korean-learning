/** Validate runtime configuration before creating database or auth clients. */
export function validateServerEnv(env: NodeJS.ProcessEnv) {
  const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}. Set them in .env; see README.md and .env.example.`);
  }

  const databaseUrl = env.DATABASE_URL!;
  let database: URL;
  try { database = new URL(databaseUrl); }
  catch { throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL. See README.md."); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname || !database.pathname.slice(1)) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL with a database name. See README.md.");
  }

  const secret = env.BETTER_AUTH_SECRET!;
  if (secret.length < 32 || /^korean-zero-dev-secret/i.test(secret)) {
    throw new Error("BETTER_AUTH_SECRET must be a unique random value of at least 32 characters. Generate one as described in README.md.");
  }

  for (const name of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    let url: URL;
    try { url = new URL(env[name]!); }
    catch { throw new Error(`${name} must be an absolute http(s) URL. See README.md.`); }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`${name} must be an absolute http(s) URL. See README.md.`);
    }
  }

  return {
    databaseUrl,
    authSecret: secret,
    authUrl: env.BETTER_AUTH_URL!,
    publicAppUrl: env.NEXT_PUBLIC_APP_URL!,
  };
}
