import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { withSerializableRetry } from "@/modules/admin/admin-transaction";
import { ConflictError } from "@/shared/errors/domain-errors";

afterEach(() => vi.restoreAllMocks());
const writeConflict = () => new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "7.10.0" });
describe("Serializable authoring transactions", () => {
  it("retries serialization failures and returns the committed result", async () => {
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(writeConflict()).mockResolvedValueOnce("committed");
    expect(await withSerializableRetry(async () => "committed")).toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it("reports a recoverable conflict after three failed attempts", async () => {
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValue(writeConflict());
    await expect(withSerializableRetry(async () => null)).rejects.toThrow(ConflictError);
    expect(transaction).toHaveBeenCalledTimes(3);
  });
  it("does not retry domain validation or other errors", async () => {
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValue(new Error("invalid"));
    await expect(withSerializableRetry(async () => null)).rejects.toThrow("invalid");
    expect(transaction).toHaveBeenCalledOnce();
  });
  it("retries the pg adapter's commit-time serialization error", async () => {
    const error = new Error("TransactionWriteConflict", { cause: { kind: "TransactionWriteConflict" } }); error.name = "DriverAdapterError";
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(error).mockResolvedValueOnce("committed");
    expect(await withSerializableRetry(async () => "committed")).toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it("allows bounded graph imports extra retries without passing retry settings to Prisma", async () => {
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(writeConflict()).mockRejectedValueOnce(writeConflict()).mockRejectedValueOnce(writeConflict()).mockResolvedValue("graph");
    expect(await withSerializableRetry(async () => "graph", { timeout: 30000, maxWait: 10000, maxAttempts: 6 })).toBe("graph");
    expect(transaction).toHaveBeenCalledTimes(4);
    expect(transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable", timeout: 30000, maxWait: 10000 });
  });
});
