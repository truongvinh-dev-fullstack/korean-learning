import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  // Public CA only: inline it so the separately deployed proxy needs no PEM file.
  env: {
    SUPABASE_CA_CERT: readFileSync(join(process.cwd(), "certs/supabase-ca.crt"), "utf8"),
  },
  outputFileTracingIncludes: {
    "/*": ["./certs/supabase-ca.crt"],
  },
};

export default nextConfig;
