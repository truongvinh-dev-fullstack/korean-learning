import type { PoolConfig } from "pg";

/** Use the bundled public CA when the URL requests our Supabase certificate. */
export function databaseConnectionOptions(
  connectionString: string,
  bundledCa?: string,
): Pick<PoolConfig, "connectionString" | "ssl"> {
  const url = new URL(connectionString);
  if (
    !bundledCa ||
    url.searchParams.get("sslrootcert") !== "certs/supabase-ca.crt" ||
    url.searchParams.get("sslmode") !== "verify-full" ||
    url.searchParams.has("sslcert") ||
    url.searchParams.has("sslkey")
  ) {
    // CLI scripts and custom TLS configurations retain pg's normal URL handling.
    return { connectionString };
  }

  // pg's URL SSL parameters override the explicit ssl object and read from disk.
  url.searchParams.delete("sslrootcert");
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  url.searchParams.delete("uselibpqcompat");
  return {
    connectionString: url.toString(),
    ssl: { ca: bundledCa, rejectUnauthorized: true },
  };
}
