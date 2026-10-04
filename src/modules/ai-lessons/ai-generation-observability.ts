import "server-only";
import type { AiGenerationContext } from "./ai-generation.types";
import { LESSON_PROMPT_VERSION } from "./lesson-generation-prompt";
type Event = "ai.lesson.generate.started" | "ai.lesson.generate.completed" | "ai.lesson.generate.failed" | "ai.lesson.schema.invalid" | "ai.lesson.knowledge.validation";
export function logAiGeneration(event: Event, context: AiGenerationContext, details: {
  durationMs?: number; code?: string; schemaValid?: boolean; errors?: number; warnings?: number; info?: number; blocks?: number; vocabulary?: number; questions?: number; issues?: { code: string; path: string }[];
} = {}) {
  // Explicit allowlist. Never pass Error objects, prompts, drafts, headers or raw responses.
  console.info(JSON.stringify({ event, requestId: context.requestId, userId: context.userId, provider: context.provider, model: context.model,
    promptVersion: context.promptVersion ?? LESSON_PROMPT_VERSION, durationMs: context.startedAtMs ? Date.now() - context.startedAtMs : 0, retryCount: context.retryCount, ...details, ...(context.usage ? { inputTokens: context.usage.inputTokens, outputTokens: context.usage.outputTokens, totalTokens: context.usage.totalTokens } : {}) }));
}
