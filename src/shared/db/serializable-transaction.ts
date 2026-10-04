import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { ConflictError } from "@/shared/errors/domain-errors";

function isWriteConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034";
  // Prisma 7's pg adapter can report a serialization failure at COMMIT directly.
  if (!(error instanceof Error) || error.name !== "DriverAdapterError") return false;
  const cause = error.cause;
  return !!cause && typeof cause === "object" && "kind" in cause && cause.kind === "TransactionWriteConflict";
}

/** Retry PostgreSQL serialization failures by re-reading the whole transaction. */
export async function withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options?: { timeout?: number; maxWait?: number; maxAttempts?: number }): Promise<T> {
  const { maxAttempts = 3, ...transactionOptions } = options ?? {};
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, ...transactionOptions });
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
      if (attempt === maxAttempts - 1) throw new ConflictError("Dữ liệu đang được cập nhật đồng thời. Hãy tải lại và thử lại.");
      await new Promise((resolve) => setTimeout(resolve, Math.min(40 * 2 ** attempt, 800) + Math.floor(Math.random() * 40)));
    }
  }
  throw new Error("Unreachable transaction retry state");
}
