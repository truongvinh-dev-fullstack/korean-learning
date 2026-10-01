import { afterEach, describe, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/shared/db/prisma", () => ({ prisma: { $queryRaw: query } }));
import { GET } from "@/app/api/health/route";
afterEach(() => { query.mockReset(); vi.restoreAllMocks(); });
describe("F7 public health failures", () => {
  it("logs the original error and never returns its diagnostic marker", async () => {
    const error = new Error("private-connection-query-diagnostic");
    query.mockRejectedValueOnce(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET();
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).not.toContain(error.message);
    expect(JSON.parse(body)).toMatchObject({ database: "disconnected", error: "Database health check unavailable." });
    expect(log).toHaveBeenCalledWith("Health database check failed", error);
  });
});
