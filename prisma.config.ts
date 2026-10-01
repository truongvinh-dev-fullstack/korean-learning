import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a session/direct connection, not Supavisor transaction mode.
    // Leave this optional so `prisma generate` works before configuring a database.
    url: process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim(),
  },
});
