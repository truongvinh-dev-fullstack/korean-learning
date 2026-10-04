import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readAiProviderConfig, AiProviderConfigurationError } from "../src/modules/ai-lessons/ai-provider.config";
import { getLessonAiProvider } from "../src/modules/ai-lessons/lesson-ai-provider";
import { parseAiLessonDraft } from "../src/modules/ai-lessons/ai-lesson-normalizer";
import { validateLessonKnowledge } from "../src/modules/ai-lessons/lesson-knowledge-validator";
import { verifiedAiAudio } from "../src/modules/ai-lessons/ai-audio-verification";
import { LESSON_PROMPT_VERSION } from "../src/modules/ai-lessons/lesson-generation-prompt";
import { DomainError } from "../src/shared/errors/domain-errors";
import type { AiGenerationContext } from "../src/modules/ai-lessons/ai-generation.types";
async function main() {
  const config = readAiProviderConfig();
  if (process.argv.includes("--check-config")) {
    console.info(JSON.stringify({ configValid: true, provider: config.provider, model: config.model, promptVersion: LESSON_PROMPT_VERSION, networkCalled: false, databaseWrites: false })); return;
  }
  if (!["openai", "http"].includes(config.provider)) throw new DomainError("Hãy cấu hình provider thật trước khi chạy smoke test.", "AI_PROVIDER_UNAVAILABLE", 503);
  const topicIndex = process.argv.indexOf("--topic"), topic = topicIndex >= 0 ? process.argv[topicIndex + 1] : "Giới thiệu ㅏ, ㅓ, ㅗ, ㅜ cho người mới bắt đầu";
  const provider = getLessonAiProvider(config), started = Date.now();
  const context: AiGenerationContext = { requestId: randomUUID(), userId: "manual-provider-test", provider: provider.name ?? "custom", model: provider.model ?? "", retryCount: 0 };
  const raw = await provider.generateLesson({ topic, level: "BEGINNER_1", duration: 20, lessonNumber: 1, targetAudience: "Người Việt mới bắt đầu", notes: null }, context);
  const parsed = parseAiLessonDraft(raw);
  const validation = parsed.draft ? validateLessonKnowledge(parsed.draft, await verifiedAiAudio(parsed.draft)) : parsed.validation;
  console.info(JSON.stringify({ requestId: context.requestId, provider: context.provider, model: context.model, promptVersion: LESSON_PROMPT_VERSION,
    durationMs: Date.now() - started, retryCount: context.retryCount, usage: context.usage, schemaValid: validation.schemaValid, knowledgeValid: validation.valid,
    errors: validation.errors.length, warnings: validation.warnings.length, info: validation.info.length, blocks: parsed.draft?.contentBlocks.length ?? 0,
    vocabulary: parsed.draft?.vocabulary.length ?? 0, questions: parsed.draft?.exercises.reduce((n, e) => n + e.questions.length, 0) ?? 0,
    issues: [...validation.errors, ...validation.warnings].map(({ code, path }) => ({ code, path })), databaseWrites: false }));
  if (!validation.valid) process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(JSON.stringify({ code: error instanceof DomainError ? error.code : error instanceof AiProviderConfigurationError ? "AI_PROVIDER_UNAVAILABLE" : "AI_GENERATION_FAILED",
    message: error instanceof AiProviderConfigurationError ? error.message : error instanceof DomainError ? error.message : "Provider test failed. Check server configuration.", databaseWrites: false }));
  process.exitCode = 1;
});
