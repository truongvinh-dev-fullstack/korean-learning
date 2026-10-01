import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  outputFileTracingIncludes: {
    "/*": ["./certs/supabase-ca.crt"],
  },
};

export default nextConfig;
