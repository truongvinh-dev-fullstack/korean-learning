import "dotenv/config";
import { describe, it, expect } from "vitest";
import { prisma } from "@/shared/db/prisma";
import { GET } from "@/app/api/health/route";

describe("Health Check & Database Connectivity", () => {
  it("preserves the successful route response", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", app: "healthy", database: "connected" });
  });
  it("successfully connects to the PostgreSQL database and runs raw query", async () => {
    const result = await prisma.$queryRaw<{ result: number; current_db: string }[]>`
      SELECT 1 as result, current_database() as current_db;
    `;

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].result).toBe(1);
    expect(result[0].current_db).toBe(new URL(process.env.DATABASE_URL!).pathname.slice(1));
  });

  it("verifies application environment variables are defined", () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).toContain("postgresql://");
  });
});
