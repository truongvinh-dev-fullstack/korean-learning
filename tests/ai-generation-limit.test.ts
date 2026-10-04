import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { readAiProviderConfig } from "@/modules/ai-lessons/ai-provider.config";
import { PostgresAiGenerationLimiter } from "@/modules/ai-lessons/ai-generation-limit";
const users: string[] = [], limiter = new PostgresAiGenerationLimiter();
const user = () => { const id = randomUUID(); users.push(id); return id; };
const config = () => ({ ...readAiProviderConfig({ NODE_ENV: "test", AI_LESSON_PROVIDER: "disabled" }), rateLimit: 2 });
afterEach(async () => { await prisma.aiLessonGenerationLimit.deleteMany({ where: { userId: { in: users } } }); users.length = 0; });
it("coordinates simultaneous requests across independent limiter instances", async () => {
  const id = user(); const results = await Promise.allSettled([limiter.acquire(id, randomUUID(), config()), new PostgresAiGenerationLimiter().acquire(id, randomUUID(), config())]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find((r) => r.status === "rejected"); expect(rejected?.status === "rejected" && rejected.reason.code).toBe("AI_RATE_LIMITED");
  for (const result of results) if (result.status === "fulfilled") await result.value();
});
it("counts failed/completed attempts, isolates admins and resets an expired window", async () => {
  const id = user(); for (let i = 0; i < 2; i++) await (await limiter.acquire(id, randomUUID(), config()))();
  await expect(limiter.acquire(id, randomUUID(), config())).rejects.toMatchObject({ code: "AI_RATE_LIMITED", statusCode: 429 });
  await (await limiter.acquire(user(), randomUUID(), config()))();
  await prisma.aiLessonGenerationLimit.update({ where: { userId: id }, data: { windowStart: new Date(Date.now() - config().rateWindowMs - 1000) } });
  await (await limiter.acquire(id, randomUUID(), config()))(); expect((await prisma.aiLessonGenerationLimit.findUniqueOrThrow({ where: { userId: id } })).requestCount).toBe(1);
});
it("recovers an abandoned lease and prevents an old request releasing its successor", async () => {
  const id = user(), successor = randomUUID(), releaseOld = await limiter.acquire(id, successor, config());
  await prisma.aiLessonGenerationLimit.update({ where: { userId: id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
  const releaseNew = await limiter.acquire(id, successor, config()); await releaseOld();
  expect((await prisma.aiLessonGenerationLimit.findUniqueOrThrow({ where: { userId: id } })).activeRequestId).toMatch(new RegExp(`^${successor}:`)); await releaseNew();
});
