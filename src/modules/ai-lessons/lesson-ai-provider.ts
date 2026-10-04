import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/shared/errors/domain-errors";
import { AI_PAYLOAD_LIMIT, type AiLessonGenerateInput } from "./ai-lesson.schema";
import { z } from "zod";
import { readAiProviderConfig, type AiProviderConfig } from "./ai-provider.config";
import { buildLessonGenerationPrompt, AI_LESSON_JSON_SCHEMA, LESSON_PROMPT_VERSION } from "./lesson-generation-prompt";
import { AI_PROVIDER_OUTPUT_SCHEMA, decodeProviderOptionalFields } from "./ai-provider-schema";
import { assertProviderResponse, providerError, runProviderRequest } from "./ai-provider.transport";
import type { AiGenerationContext } from "./ai-generation.types";

export interface LessonAiProvider { readonly name?: AiGenerationContext["provider"]; readonly model?: string; generateLesson(input: AiLessonGenerateInput, context?: AiGenerationContext): Promise<unknown> }
export const AI_LESSON_CONTRACT = {
  schema: AI_LESSON_JSON_SCHEMA,
  lesson: { title: "string", slug: "ascii-kebab-case", summary: "string", estimatedDuration: "integer 0..180", level: "string", tags: ["string"] },
  learningObjectives: ["string"],
  contentBlocks: [{ clientId: "block-1", order: 0, type: "TEXT|HANGUL|VOCABULARY|GRAMMAR|EXAMPLE|DIALOGUE|AUDIO|IMAGE|CALLOUT", content: "existing Lesson Detail block schema; VOCABULARY uses vocabularyClientIds only" }],
  vocabulary: [{ clientId: "vocab-1", hangul: "string", romanization: "string", vietnamese: "string", english: "string|null", partOfSpeech: "string|null", audioUrl: "string|null", difficulty: "integer 1..5|null", tags: [] }],
  exercises: [{ clientId: "exercise-1", order: 0, title: "string", description: "string|null", questions: [{ clientId: "question-1", order: 0, type: "supported QuestionType", prompt: "string", audioUrl: "string|null", correctAnswer: "string|null", explanation: "string|null", content: "QuestionContentMap", options: [{ text: "string", isCorrect: true }] }] }],
  rules: ["Return JSON only. All clientIds globally unique, all sibling orders unique. Never generate DB IDs.", "Questions use only taught material. Writing/pronunciation gradingMode MANUAL. Do not invent audio URLs.", "Generate Vietnamese explanations and preserve Korean Unicode."],
};
export async function readLimitedJson(response: Response | Request, limit = AI_PAYLOAD_LIMIT): Promise<unknown> {
  if (Number(response.headers.get("content-length") ?? 0) > limit) throw new DomainError("Payload vượt giới hạn cho phép.", "AI_PAYLOAD_TOO_LARGE", 413);
  const reader = response.body?.getReader();
  if (!reader) throw new DomainError("Thiếu JSON trong yêu cầu.", "AI_JSON_INVALID", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
      if (size > limit) { await reader.cancel(); throw new DomainError("Payload vượt giới hạn cho phép.", "AI_PAYLOAD_TOO_LARGE", 413); } chunks.push(value);
    }
    const data = new Uint8Array(size); let offset = 0; chunks.forEach((chunk) => { data.set(chunk, offset); offset += chunk.length; });
    try { return JSON.parse(new TextDecoder().decode(data)); } catch { throw new DomainError("JSON không hợp lệ.", "AI_JSON_INVALID", 400); }
  } finally { reader.releaseLock(); }
}
async function readProviderJson(response: Response, limit = AI_PAYLOAD_LIMIT) {
  try { return await readLimitedJson(response, limit); }
  catch (error) {
    if (error instanceof DomainError) throw providerError("AI_INVALID_RESPONSE");
    throw error; // Transport can retry a transient interruption while reading the body.
  }
}
export class HttpLessonAiProvider implements LessonAiProvider {
  readonly name = "http" as const;
  constructor(private readonly endpoint: string, private readonly apiKey: string, readonly model = "http-bridge", private readonly options = { timeoutMs: 90000, maxAttempts: 3, maxOutputTokens: 12000 }) {}
  async generateLesson(input: AiLessonGenerateInput, context?: AiGenerationContext) {
    try { const url = new URL(this.endpoint); if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !this.apiKey) throw new Error(); }
    catch { throw providerError("AI_PROVIDER_UNAVAILABLE", 503); }
    const prompt = buildLessonGenerationPrompt(input);
    return runProviderRequest(async (signal) => {
      const response = await fetch(this.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}`, ...(context ? { "X-Client-Request-Id": context.requestId } : {}) }, body: JSON.stringify({ input, contract: AI_LESSON_CONTRACT, prompt, model: this.model, maxOutputTokens: this.options.maxOutputTokens, promptVersion: LESSON_PROMPT_VERSION }), signal, redirect: "error", cache: "no-store" });
      await assertProviderResponse(response);
      return readProviderJson(response);
    }, this.options, context);
  }
}
const OpenAiResponseSchema = z.object({ status: z.string(), output: z.array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()).optional() }).loose()),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative(), total_tokens: z.number().int().nonnegative() }).loose().nullish(),
}).loose();
export class OpenAiLessonProvider implements LessonAiProvider {
  readonly name = "openai" as const;
  readonly model: string;
  constructor(private readonly config: AiProviderConfig) { this.model = config.model; }
  async generateLesson(input: AiLessonGenerateInput, context?: AiGenerationContext) {
    if (!this.config.apiKey || !this.config.model) throw providerError("AI_PROVIDER_UNAVAILABLE", 503);
    const prompt = buildLessonGenerationPrompt(input);
    return runProviderRequest(async (signal) => {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/responses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}`, ...(context ? { "X-Client-Request-Id": context.requestId } : {}) },
        body: JSON.stringify({ model: this.model, ...prompt, store: false, max_output_tokens: this.config.maxOutputTokens,
          text: { format: { type: "json_schema", name: "lesson_draft", strict: true, schema: AI_PROVIDER_OUTPUT_SCHEMA } },
          metadata: { prompt_version: LESSON_PROMPT_VERSION, ...(context ? { request_id: context.requestId } : {}) } }),
        signal, redirect: "error", cache: "no-store" });
      await assertProviderResponse(response);
      const raw = await readProviderJson(response, AI_PAYLOAD_LIMIT * 2);
      const parsed = OpenAiResponseSchema.safeParse(raw);
      if (!parsed.success) throw providerError("AI_INVALID_RESPONSE");
      if (context && parsed.data.usage) context.usage = { inputTokens: parsed.data.usage.input_tokens, outputTokens: parsed.data.usage.output_tokens, totalTokens: parsed.data.usage.total_tokens };
      if (parsed.data.status !== "completed") throw providerError("AI_INVALID_RESPONSE");
      const content = parsed.data.output.filter((v) => v.type === "message").flatMap((v) => v.content ?? []);
      if (content.some((v) => v.type === "refusal")) throw providerError("AI_GENERATION_FAILED");
      const texts = content.filter((v) => v.type === "output_text");
      if (texts.length !== 1 || !texts[0].text || Buffer.byteLength(texts[0].text) > AI_PAYLOAD_LIMIT) throw providerError("AI_INVALID_RESPONSE");
      try { return decodeProviderOptionalFields(JSON.parse(texts[0].text)); } catch { throw providerError("AI_INVALID_RESPONSE"); }
    }, this.config, context);
  }
}
/** Explicit dev/test opt-in; never fallback to mock on a production provider failure. */
export class MockLessonAiProvider implements LessonAiProvider {
  readonly name = "mock" as const;
  readonly model = "fixture";
  async generateLesson(input: AiLessonGenerateInput) {
    if (process.env.NODE_ENV === "production") throw new DomainError("Mock provider không được dùng trong production.", "AI_PROVIDER_UNAVAILABLE", 503);
    const fixture = /chưa học|invalid knowledge/i.test(input.topic) ? "invalid-knowledge-generation" : /invalid schema/i.test(input.topic) ? "invalid-schema-generation" : "valid-lesson-generation";
    const draft: unknown = JSON.parse(await readFile(path.join(process.cwd(), "docs/examples/ai", `${fixture}.json`), "utf8"));
    return draft;
  }
}
export function getLessonAiProvider(config?: AiProviderConfig): LessonAiProvider {
  try {
    const settings = config ?? readAiProviderConfig();
    if (settings.provider === "mock") return new MockLessonAiProvider();
    if (settings.provider === "openai") return new OpenAiLessonProvider(settings);
    if (settings.provider === "http") return new HttpLessonAiProvider(settings.endpoint, settings.apiKey, settings.model, settings);
  } catch { /* Configuration details stay on the server startup boundary. */ }
  throw new DomainError("Chưa cấu hình AI provider. Quản trị hệ thống cần cấu hình provider trước khi tạo bản nháp.", "AI_PROVIDER_UNAVAILABLE", 503);
}
