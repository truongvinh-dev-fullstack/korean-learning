import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertAdminRole } from "@/shared/auth/roles";
import { DomainError, ValidationError } from "@/shared/errors/domain-errors";
import { AiLessonGenerateInputSchema, AiLessonImportPayloadSchema, AiLessonTargetSchema, type AiLessonPreview, type AiLessonTarget } from "./ai-lesson.schema";
import { parseAiLessonDraft } from "./ai-lesson-normalizer";
import { validateLessonKnowledge } from "./lesson-knowledge-validator";
import { verifiedAiAudio } from "./ai-audio-verification";
import { getLessonAiProvider, type LessonAiProvider } from "./lesson-ai-provider";
import { aiImportHash, issueAiValidationToken, verifyAiValidationToken, issueAiGenerationToken, verifyAiGenerationToken } from "./ai-lesson-token";
import { AiLessonRepository } from "./ai-lesson.repository";
import { readAiProviderConfig } from "./ai-provider.config";
import { providerError } from "./ai-provider.transport";
import { PostgresAiGenerationLimiter, type AiGenerationLimiter } from "./ai-generation-limit";
import { logAiGeneration } from "./ai-generation-observability";
import { LESSON_PROMPT_VERSION } from "./lesson-generation-prompt";
import type { AiGenerationContext, AiGenerationMetadata } from "./ai-generation.types";

type Admin = { id: string; role?: string | null };
const audit = (event: string, data: Record<string, string | number | boolean>) => console.info(`[ai-lesson] ${event}`, data);
export class AiLessonService {
  constructor(private readonly provider?: LessonAiProvider, private readonly repo = new AiLessonRepository(), private readonly limiter: AiGenerationLimiter = new PostgresAiGenerationLimiter()) {}
  async validateDraft(user: Admin, raw: unknown, rawTarget: unknown, generationToken?: string, trace?: AiGenerationContext): Promise<AiLessonPreview> {
    assertAdminRole(user); const target = AiLessonTargetSchema.parse(rawTarget);
    const generation = verifyAiGenerationToken(generationToken, user.id);
    const provenance = generation ? { generation, generationToken } : {};
    const context: AiGenerationContext = trace ?? { requestId: generation?.requestId ?? randomUUID(), userId: user.id, provider: generation?.provider ?? "custom", model: generation?.model ?? "manual-validation", promptVersion: generation?.promptVersion, startedAtMs: Date.now(), retryCount: generation?.retryCount ?? 0, usage: generation?.usage };
    const parsed = parseAiLessonDraft(raw);
    if (!parsed.draft) { logAiGeneration("ai.lesson.schema.invalid", context, { schemaValid: false, errors: parsed.validation.errors.length, warnings: 0, issues: parsed.validation.errors.slice(0, 20).map(({ code, path }) => ({ code, path: path.slice(0, 200) })) }); return { ...parsed, ...provenance, validationToken: null, errorCode: "AI_SCHEMA_VALIDATION_FAILED" }; }
    const draft = parsed.draft, verified = await verifiedAiAudio(draft);
    const validation = validateLessonKnowledge(draft, verified);
    logAiGeneration("ai.lesson.knowledge.validation", context, { schemaValid: true, errors: validation.errors.length, warnings: validation.warnings.length, info: validation.info.length });
    return { draft, validation, ...provenance, validationToken: validation.valid ? issueAiValidationToken(user.id, await this.repo.previewFingerprint(target, aiImportHash(draft, target, generation))) : null };
  }
  async generateDraft(user: Admin, input: unknown, target: unknown, requestId: string = randomUUID()) {
    assertAdminRole(user); const parsedInput = AiLessonGenerateInputSchema.parse(input); AiLessonTargetSchema.parse(target);
    z.uuid().parse(requestId);
    const started = Date.now();
    const context: AiGenerationContext = { requestId, userId: user.id, provider: this.provider?.name ?? "custom", model: this.provider?.model ?? "", startedAtMs: started, retryCount: 0 };
    let release: (() => Promise<void>) | undefined;
    try {
      let config;
      try { config = readAiProviderConfig(); } catch { throw providerError("AI_PROVIDER_UNAVAILABLE", 503); }
      const provider = this.provider ?? getLessonAiProvider(config);
      context.provider = provider.name ?? "custom"; context.model = provider.model ?? "custom";
      logAiGeneration("ai.lesson.generate.started", context, { durationMs: 0 });
      release = await this.limiter.acquire(user.id, requestId, config);
      const raw = await provider.generateLesson(parsedInput, context);
      const metadata: AiGenerationMetadata = { requestId, provider: context.provider, model: context.model, promptVersion: LESSON_PROMPT_VERSION,
        generatedAt: new Date().toISOString(), durationMs: Date.now() - started, retryCount: context.retryCount, ...(context.usage ? { usage: context.usage } : {}) };
      const token = issueAiGenerationToken(user.id, metadata);
      const preview = await this.validateDraft(user, raw, target, token, context);
      logAiGeneration(preview.validation.schemaValid ? "ai.lesson.generate.completed" : "ai.lesson.generate.failed", context, {
        durationMs: Date.now() - started, ...(preview.errorCode ? { code: preview.errorCode } : {}), schemaValid: preview.validation.schemaValid,
        errors: preview.validation.errors.length, warnings: preview.validation.warnings.length, info: preview.validation.info.length,
        blocks: preview.draft?.contentBlocks.length ?? 0, vocabulary: preview.draft?.vocabulary.length ?? 0, questions: preview.draft?.exercises.reduce((sum, e) => sum + e.questions.length, 0) ?? 0 });
      return { ...preview, requestId };
    } catch (error) {
      logAiGeneration("ai.lesson.generate.failed", context, { durationMs: Date.now() - started, code: error instanceof DomainError ? error.code : "AI_GENERATION_FAILED" });
      if (error instanceof DomainError) throw error;
      throw providerError("AI_GENERATION_FAILED");
    } finally {
      if (release) try { await release(); } catch { logAiGeneration("ai.lesson.generate.failed", context, { durationMs: Date.now() - started, code: "AI_LIMIT_RELEASE_FAILED" }); }
    }
  }
  async importAiLessonDraft(user: Admin, raw: unknown) {
    assertAdminRole(user); const payload = AiLessonImportPayloadSchema.parse(raw);
    try {
      const generation = verifyAiGenerationToken(payload.generationToken, user.id);
      const preview = await this.validateDraft(user, payload.draft, payload.target, payload.generationToken);
      if (!preview.draft || !preview.validation.valid) throw new ValidationError("Bản nháp còn lỗi; hãy chỉnh sửa và kiểm tra lại.", preview.validation);
      const hash = aiImportHash(preview.draft, payload.target, generation);
      const previous = await this.repo.findImportReceipt(user.id, payload.idempotencyKey, hash);
      if (previous) { audit("import success", { userId: user.id, lessonId: previous.lessonId, replayed: true }); return previous; } // Recover after preview expiry.
      const fingerprint = await this.repo.previewFingerprint(payload.target, hash);
      verifyAiValidationToken(payload.validationToken, user.id, fingerprint);
      const result = await this.repo.importDraft(user.id, preview.draft, payload.target, payload.idempotencyKey, hash, payload.replaceConfirmed, fingerprint, generation);
      audit("import success", { userId: user.id, lessonId: result.lessonId, mode: payload.target.mode, replayed: result.replayed }); return result;
    } catch (error) {
      audit("import failure", { userId: user.id, code: error instanceof DomainError ? error.code : "IMPORT_FAILURE" });
      if (error instanceof DomainError) throw error;
      if (error instanceof z.ZodError) throw new ValidationError("Graph bài học không hợp lệ; toàn bộ thay đổi đã rollback.");
      throw new DomainError("Không nhập được bài học; toàn bộ thay đổi đã rollback. Có thể thử lại cùng yêu cầu.", "AI_IMPORT_FAILED", 500);
    }
  }
}
export const aiLessonService = new AiLessonService();
export type { AiLessonTarget };
