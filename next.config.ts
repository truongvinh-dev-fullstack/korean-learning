import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readAiProviderConfig } from "./src/modules/ai-lessons/ai-provider.config";

// Validate while loading config as well as instrumentation: this Next release can
// keep a process alive after a rejected instrumentation hook.
readAiProviderConfig();

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
