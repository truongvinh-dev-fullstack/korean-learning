import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { databaseConnectionOptions } from "@/shared/db/connection-options";

const ca = nextConfig.env!.SUPABASE_CA_CERT!;
const databaseUrl = "postgresql://user:pass@db.example.com:6543/postgres?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt";

describe("Bundled Supabase database certificate", () => {
  it("bundles the repository CA without changing its identity", () => {
    expect(ca).toBe(readFileSync("certs/supabase-ca.crt", "utf8"));
    expect(new X509Certificate(ca).fingerprint256).toBe(
      "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
    );
  });

  it("lets pg initialize TLS without a runtime certificate file", () => {
    const options = databaseConnectionOptions(databaseUrl, ca);
    expect(new URL(options.connectionString!).searchParams.has("sslrootcert")).toBe(false);
    const client = new Client(options);
    expect(client.ssl).toEqual({ ca, rejectUnauthorized: true });
    expect(client.host).toBe("db.example.com");
    expect(client.port).toBe(6543);
    expect(client.database).toBe("postgres");
  });

  it("keeps certificate and hostname verification enabled despite conflicting URL flags", () => {
    const client = new Client(databaseConnectionOptions(`${databaseUrl}&ssl=0&uselibpqcompat=true`, ca));
    expect(client.ssl).toEqual({ ca, rejectUnauthorized: true });
  });

  it("preserves local connections and CLI certificate loading", () => {
    const local = "postgresql://user:pass@localhost:5432/korean_zero?schema=public";
    expect(databaseConnectionOptions(local, ca)).toEqual({ connectionString: local });
    expect(databaseConnectionOptions(databaseUrl)).toEqual({ connectionString: databaseUrl });
  });

  it("preserves custom certificates and other SSL modes", () => {
    for (const url of [
      databaseUrl.replace("certs/supabase-ca.crt", "certs/custom-ca.crt"),
      databaseUrl.replace("verify-full", "disable"),
      `${databaseUrl}&sslcert=client.crt&sslkey=client.key`,
    ]) {
      expect(databaseConnectionOptions(url, ca)).toEqual({ connectionString: url });
    }
  });
});
