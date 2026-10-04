import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { DomainError } from "@/shared/errors/domain-errors";
import { AI_GENERATION_MESSAGES } from "./ai-generation.errors";
import type { AiProviderConfig } from "./ai-provider.config";
export class AiGenerationLimitError extends DomainError {
  constructor(readonly retryAfterSeconds: number) { super(AI_GENERATION_MESSAGES.AI_RATE_LIMITED, "AI_RATE_LIMITED", 429); }
}
export interface AiGenerationLimiter { acquire(userId: string, requestId: string, config: AiProviderConfig): Promise<() => Promise<void>> }
export class PostgresAiGenerationLimiter implements AiGenerationLimiter {
  async acquire(userId: string, requestId: string, config: AiProviderConfig) {
    const owner = `${requestId}:${randomUUID()}`; // Private lease nonce protects even reused client request IDs.
    // Row lock coordinates all instances. The provider call is outside this short transaction.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO "AiLessonGenerationLimit" ("userId", "windowStart", "requestCount") VALUES (${userId}, CURRENT_TIMESTAMP, 0) ON CONFLICT ("userId") DO NOTHING`;
      await tx.$queryRaw`SELECT "userId" FROM "AiLessonGenerationLimit" WHERE "userId" = ${userId} FOR UPDATE`;
      const row = await tx.aiLessonGenerationLimit.findUniqueOrThrow({ where: { userId } });
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock.now.getTime();
      if (row.activeRequestId && row.leaseExpiresAt && row.leaseExpiresAt.getTime() > now) throw new AiGenerationLimitError(Math.max(1, Math.ceil((row.leaseExpiresAt.getTime() - now) / 1000)));
      const reset = now >= row.windowStart.getTime() + config.rateWindowMs;
      if (!reset && row.requestCount >= config.rateLimit) throw new AiGenerationLimitError(Math.max(1, Math.ceil((row.windowStart.getTime() + config.rateWindowMs - now) / 1000)));
      await tx.aiLessonGenerationLimit.update({ where: { userId }, data: { windowStart: reset ? clock.now : row.windowStart, requestCount: reset ? 1 : row.requestCount + 1, activeRequestId: owner, leaseExpiresAt: new Date(now + config.timeoutMs + 60000) } });
    });
    return async () => { await prisma.aiLessonGenerationLimit.updateMany({ where: { userId, activeRequestId: owner }, data: { activeRequestId: null, leaseExpiresAt: null } }); };
  }
}
