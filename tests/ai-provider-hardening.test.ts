import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";
import valid from "../docs/examples/ai/valid-lesson-generation.json";
import invalidSchema from "../docs/examples/ai/invalid-schema-generation.json";
import { readAiProviderConfig } from "@/modules/ai-lessons/ai-provider.config";
import { OpenAiLessonProvider, getLessonAiProvider } from "@/modules/ai-lessons/lesson-ai-provider";
import { AI_PROVIDER_OUTPUT_SCHEMA, decodeProviderOptionalFields } from "@/modules/ai-lessons/ai-provider-schema";
import { AiLessonService } from "@/modules/ai-lessons/ai-lesson.service";
import { AiLessonRepository } from "@/modules/ai-lessons/ai-lesson.repository";
import { buildLessonGenerationPrompt, LESSON_PROMPT_VERSION } from "@/modules/ai-lessons/lesson-generation-prompt";
import { parseAiLessonDraft } from "@/modules/ai-lessons/ai-lesson-normalizer";
import { verifiedAiAudio } from "@/modules/ai-lessons/ai-audio-verification";
import { validateLessonKnowledge } from "@/modules/ai-lessons/lesson-knowledge-validator";
import { issueAiGenerationToken, verifyAiGenerationToken } from "@/modules/ai-lessons/ai-lesson-token";
import { handleAiLessonRequest } from "@/modules/ai-lessons/ai-lesson.api";
import { aiLessonService } from "@/modules/ai-lessons/ai-lesson.service";
import { NextRequest } from "next/server";
import { AiGenerationLimitError } from "@/modules/ai-lessons/ai-generation-limit";
import type { AiGenerationContext, AiGenerationMetadata } from "@/modules/ai-lessons/ai-generation.types";

const { requireAdminApi } = vi.hoisted(() => ({ requireAdminApi: vi.fn() }));
vi.mock("@/shared/auth/admin-guard", async (original) => ({ ...await original<typeof import("@/shared/auth/admin-guard")>(), requireAdminApi }));
const admin = { id: randomUUID(), role: "ADMIN" }, target = { mode: "NEW", chapterId: "legacy-chapter" };
const input = { topic: "10 nguyên âm", level: "BEGINNER_1", lessonNumber: 1, duration: 20, targetAudience: "Người Việt", notes: null };
const config = () => readAiProviderConfig({ NODE_ENV: "test", AI_LESSON_PROVIDER: "openai", AI_LESSON_API_KEY: "private-api-key", AI_LESSON_MODEL: "configured-model", AI_LESSON_TIMEOUT_MS: "5000" });
const context = (): AiGenerationContext => ({ requestId: randomUUID(), userId: admin.id, provider: "openai", model: "configured-model", retryCount: 0 });
const envelope = (output: unknown = valid) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }], usage: { input_tokens: 100, output_tokens: 250, total_tokens: 350 } });
const response = (body: unknown = envelope()) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const noLimit = { acquire: vi.fn(async () => async () => {}) };
beforeEach(() => {
  vi.stubEnv("AI_LESSON_PROVIDER", "disabled"); vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  requireAdminApi.mockResolvedValue({ user: admin, errorResponse: null }); noLimit.acquire.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("production provider configuration", () => {
  it("rejects missing key/model and rejects mock or implicit disable in production", () => {
    expect(() => readAiProviderConfig({ NODE_ENV: "production", AI_LESSON_PROVIDER: "openai", AI_LESSON_MODEL: "model" })).toThrow("AI_LESSON_API_KEY");
    expect(() => readAiProviderConfig({ NODE_ENV: "production", AI_LESSON_PROVIDER: "openai", AI_LESSON_API_KEY: "secret" })).toThrow("AI_LESSON_MODEL");
    expect(() => readAiProviderConfig({ NODE_ENV: "production", AI_LESSON_PROVIDER: "mock" })).toThrow("dev/test");
    expect(() => readAiProviderConfig({ NODE_ENV: "production" })).toThrow("AI_LESSON_PROVIDER");
    expect(readAiProviderConfig({ NODE_ENV: "production", AI_LESSON_PROVIDER: "disabled" }).provider).toBe("disabled");
  });
  it.each(["http://api.example", "https://user:secret@api.example", "https://api.example?key=secret"])("rejects insecure or credential-bearing URL %s", (url) => {
    expect(() => readAiProviderConfig({ NODE_ENV: "test", AI_LESSON_PROVIDER: "openai", AI_LESSON_API_KEY: "secret", AI_LESSON_MODEL: "model", AI_LESSON_BASE_URL: url })).toThrow("AI_LESSON_BASE_URL");
  });
  it("bounds retry, timeout, output and rate settings without exposing secrets", () => {
    for (const [key, value] of Object.entries({ AI_LESSON_MAX_ATTEMPTS: "4", AI_LESSON_TIMEOUT_MS: "Infinity", AI_LESSON_MAX_OUTPUT_TOKENS: "999999", AI_LESSON_RATE_LIMIT: "0" })) {
      expect(() => readAiProviderConfig({ NODE_ENV: "test", AI_LESSON_PROVIDER: "disabled", [key]: value })).toThrow(key);
    }
    expect(() => getLessonAiProvider()).toThrow("Chưa cấu hình");
  });
});

describe("real adapter with mocked HTTP", () => {
  it("uses strict Structured Outputs, model/token cap/store=false and propagates request ID/usage", async () => {
    const fetch = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetch); const trace = context();
    expect(await new OpenAiLessonProvider(config()).generateLesson(input, trace)).toEqual(valid);
    const [url, init] = fetch.mock.calls[0]; expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init.headers).toMatchObject({ Authorization: "Bearer private-api-key", "X-Client-Request-Id": trace.requestId });
    expect(JSON.parse(init.body)).toMatchObject({ model: "configured-model", store: false, max_output_tokens: 12000, metadata: { request_id: trace.requestId, prompt_version: LESSON_PROMPT_VERSION }, text: { format: { type: "json_schema", strict: true, schema: { type: "object", additionalProperties: false } } } });
    expect(trace.usage).toEqual({ inputTokens: 100, outputTokens: 250, totalTokens: 350 }); expect(trace.retryCount).toBe(0);
  });
  it("sends a strict wire schema with every nested property required and no allOf/open records", () => {
    const visit = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      const value = node as Record<string, unknown>; expect(value).not.toHaveProperty("allOf"); expect(value).not.toHaveProperty("oneOf"); expect(value).not.toHaveProperty("$ref");
      if (value.type === "object") { expect(value.additionalProperties).toBe(false); expect(value.required).toEqual(Object.keys(value.properties as object)); }
      for (const child of Object.values(value)) visit(child);
    }; visit(AI_PROVIDER_OUTPUT_SCHEMA);
    expect(JSON.stringify(AI_PROVIDER_OUTPUT_SCHEMA)).toContain('"MATCHING"'); expect(JSON.stringify(AI_PROVIDER_OUTPUT_SCHEMA)).toContain('"correctOrder"');
  });
  it("only removes absent optional non-nullable wire fields and retains Korean/answers", () => {
    const value = structuredClone(valid); const raw = value as unknown as { contentBlocks: { content: Record<string, unknown> }[] };
    raw.contentBlocks[0].content.title = null;
    const decoded = decodeProviderOptionalFields(value); expect(parseAiLessonDraft(decoded).draft).not.toBeNull();
    expect(JSON.stringify(decoded)).toContain("ㅏ"); expect((decoded as typeof valid).contentBlocks[0].content).not.toHaveProperty("title");
    expect((decoded as typeof valid).vocabulary[1].english).toBe(valid.vocabulary[1].english);
  });
  it.each([400, 401, 403])("never retries HTTP %i", async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response("private-response", { status })); vi.stubGlobal("fetch", fetch);
    await expect(new OpenAiLessonProvider(config()).generateLesson(input)).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retries 500 then succeeds with a bounded exponential backoff", async () => {
    vi.useFakeTimers(); const fetch = vi.fn().mockResolvedValueOnce(new Response("secret", { status: 500 })).mockResolvedValueOnce(response()); vi.stubGlobal("fetch", fetch); const trace = context();
    const promise = new OpenAiLessonProvider(config()).generateLesson(input, trace); const assertion = expect(promise).resolves.toEqual(valid);
    await vi.advanceTimersByTimeAsync(249); expect(fetch).toHaveBeenCalledTimes(1); await vi.advanceTimersByTimeAsync(1); await assertion;
    expect(fetch).toHaveBeenCalledTimes(2); expect(trace.retryCount).toBe(1);
  });
  it("retries transient network failures", async () => {
    vi.useFakeTimers(); const fetch = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(response()); vi.stubGlobal("fetch", fetch);
    const assertion = expect(new OpenAiLessonProvider(config()).generateLesson(input)).resolves.toEqual(valid); await vi.runAllTimersAsync(); await assertion; expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("retries a transient connection reset while reading a chunked response body", async () => {
    vi.useFakeTimers(); const stream = new ReadableStream({ start(controller) { controller.error(new TypeError("terminated", { cause: { code: "ECONNRESET" } })); } });
    const fetch = vi.fn().mockResolvedValueOnce(new Response(stream)).mockResolvedValueOnce(response()); vi.stubGlobal("fetch", fetch);
    const assertion = expect(new OpenAiLessonProvider(config()).generateLesson(input)).resolves.toEqual(valid);
    await vi.runAllTimersAsync(); await assertion; expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([429, 500])("stops after three attempts for HTTP %i", async (status) => {
    vi.useFakeTimers(); const fetch = vi.fn().mockImplementation(async () => new Response("private-provider-body", { status })); vi.stubGlobal("fetch", fetch);
    const assertion = expect(new OpenAiLessonProvider(config()).generateLesson(input)).rejects.toMatchObject({ code: status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_UNAVAILABLE" });
    await vi.runAllTimersAsync(); await assertion; expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("aborts timeout attempts and stays within the total time budget", async () => {
    vi.useFakeTimers(); const signals: AbortSignal[] = []; const fetch = vi.fn((_url, init: RequestInit) => { signals.push(init.signal as AbortSignal); return new Promise<Response>(() => {}); }); vi.stubGlobal("fetch", fetch);
    const assertion = expect(new OpenAiLessonProvider(config()).generateLesson(input)).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT", message: "AI tạo bài học mất quá nhiều thời gian. Vui lòng thử lại." });
    await vi.runAllTimersAsync(); await assertion; expect(fetch).toHaveBeenCalledTimes(3); expect(signals.every((s) => s.aborted)).toBe(true);
  });
  it.each(["not JSON", "```json\n{}\n```"])("rejects invalid JSON and never extracts prose: %s", async (text) => {
    const data = envelope(); data.output[0].content[0].text = text; const fetch = vi.fn().mockResolvedValue(response(data)); vi.stubGlobal("fetch", fetch);
    await expect(new OpenAiLessonProvider(config()).generateLesson(input)).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid envelope JSON, refusal and truncated output without retry", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("bad-json")).mockResolvedValueOnce(response({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] })).mockResolvedValueOnce(response({ ...envelope(), status: "incomplete" })); vi.stubGlobal("fetch", fetch); const provider = new OpenAiLessonProvider(config());
    await expect(provider.generateLesson(input)).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
    await expect(provider.generateLesson(input)).rejects.toMatchObject({ code: "AI_GENERATION_FAILED" });
    await expect(provider.generateLesson(input)).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" }); expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("service validation, telemetry and provenance", () => {
  it("rejects oversized topic/notes/audience before acquiring a slot or calling HTTP", async () => {
    const provider = { generateLesson: vi.fn() }, service = new AiLessonService(provider, new AiLessonRepository(), noLimit);
    for (const [name, size] of [["topic", 1001], ["notes", 4001], ["targetAudience", 1001]] as const) await expect(service.generateDraft(admin, { ...input, [name]: "x".repeat(size) }, target)).rejects.toThrow();
    expect(provider.generateLesson).not.toHaveBeenCalled(); expect(noLimit.acquire).not.toHaveBeenCalled();
  });
  it("returns schema errors without importing, repairing or retrying JSON-valid invalid schema", async () => {
    const fetch = vi.fn().mockResolvedValue(response(envelope(invalidSchema))); vi.stubGlobal("fetch", fetch);
    const service = new AiLessonService(new OpenAiLessonProvider(config()), new AiLessonRepository(), noLimit);
    const preview = await service.generateDraft(admin, input, target);
    expect(preview).toMatchObject({ draft: null, validationToken: null, errorCode: "AI_SCHEMA_VALIDATION_FAILED", validation: { schemaValid: false, valid: false } }); expect(preview.validation.errors.length).toBeGreaterThan(0); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("emits named scalar logs without prompts, provider bodies, API key or auth secret", async () => {
    const fetch = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetch); const requestId = randomUUID();
    const service = new AiLessonService(new OpenAiLessonProvider(config()), new AiLessonRepository(), noLimit);
    const preview = await service.generateDraft(admin, { ...input, notes: "private-learner-notes" }, target, requestId);
    expect(preview.requestId).toBe(requestId); expect(preview.generation).toMatchObject({ requestId, provider: "openai", model: "configured-model", promptVersion: LESSON_PROMPT_VERSION, usage: { totalTokens: 350 } });
    const logs = vi.mocked(console.info).mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(logs.map((l) => l.event)).toEqual(["ai.lesson.generate.started", "ai.lesson.knowledge.validation", "ai.lesson.generate.completed"]);
    expect(logs.every((l) => l.requestId === requestId && l.userId === admin.id && typeof l.durationMs === "number")).toBe(true);
    expect(logs.at(-1)).toMatchObject({ inputTokens: 100, outputTokens: 250, totalTokens: 350, retryCount: 0 });
    const text = JSON.stringify(logs); for (const secret of ["private-api-key", "private-learner-notes", input.topic, process.env.BETTER_AUTH_SECRET!, "learningObjectives"]) expect(text).not.toContain(secret);
    const edited = structuredClone(preview.draft!); edited.lesson.title = "Admin sửa";
    const checked = await service.validateDraft(admin, edited, target, preview.generationToken); expect(checked.generation).toEqual(preview.generation); expect(checked.validationToken).not.toBe(preview.validationToken);
  });
  it("keeps failed provider details out of errors/logs and releases the lease", async () => {
    const release = vi.fn(async () => {}), limiter = { acquire: vi.fn(async () => release) };
    const service = new AiLessonService({ generateLesson: async () => { throw new Error("private-key-provider-internals"); } }, new AiLessonRepository(), limiter);
    await expect(service.generateDraft(admin, input, target)).rejects.toMatchObject({ code: "AI_GENERATION_FAILED" });
    expect(release).toHaveBeenCalledOnce(); expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("private-key-provider-internals");
  });
  it("binds signed provenance to its admin and refuses tampering", () => {
    const metadata: AiGenerationMetadata = { requestId: randomUUID(), provider: "openai", model: "configured-model", promptVersion: LESSON_PROMPT_VERSION, generatedAt: new Date().toISOString(), durationMs: 100, retryCount: 0 };
    const token = issueAiGenerationToken(admin.id, metadata); expect(verifyAiGenerationToken(token, admin.id)).toEqual(metadata);
    expect(() => verifyAiGenerationToken(token, randomUUID())).toThrow("nguồn AI"); expect(() => verifyAiGenerationToken(`${token}x`, admin.id)).toThrow("nguồn AI");
  });
  it("blocks invented vocabulary/block audio while retaining editable content", async () => {
    const parsed = parseAiLessonDraft(valid).draft!; parsed.vocabulary[0].audioUrl = "/audio/generated/fake.mp3";
    const validation = validateLessonKnowledge(parsed, await verifiedAiAudio(parsed)); expect(validation.valid).toBe(false);
    expect(validation.errors).toContainEqual(expect.objectContaining({ code: "LESSON_AUDIO_UNVERIFIED", path: "vocabulary.0.audioUrl" }));
  });
  it("builds versioned scope/standards/no-fake-asset prompts without target DB graph", () => {
    const prompt = buildLessonGenerationPrompt(input); expect(prompt.input).toBe(JSON.stringify(input));
    for (const text of [LESSON_PROMPT_VERSION, "HANGEUL", "GRAMMAR", "CONVERSATION", "TOPIK", "Không bịa URL", "clientId", "tiếng Việt"]) expect(prompt.instructions).toContain(text);
    expect(prompt.input).not.toContain(target.chapterId);
  });
});

describe("API request ID and generation-only limit", () => {
  it("propagates the browser request ID into service and response header", async () => {
    const requestId = randomUUID(), spy = vi.spyOn(aiLessonService, "generateDraft").mockResolvedValue({ draft: null, validationToken: null, validation: { valid: false, schemaValid: false, errors: [], warnings: [], info: [] }, requestId });
    const result = await handleAiLessonRequest(new NextRequest("https://local/api", { method: "POST", body: JSON.stringify({ input, target, requestId }) }), "generate");
    expect(spy).toHaveBeenCalledWith(admin, input, target, requestId); expect(result.headers.get("X-Request-Id")).toBe(requestId); expect((await result.json()).data.requestId).toBe(requestId);
  });
  it("returns clear 429/Retry-After and lets import use its own pipeline", async () => {
    vi.spyOn(aiLessonService, "generateDraft").mockRejectedValue(new AiGenerationLimitError(30));
    const result = await handleAiLessonRequest(new NextRequest("https://local/api", { method: "POST", body: JSON.stringify({ input, target }) }), "generate");
    expect(result.status).toBe(429); expect(result.headers.get("Retry-After")).toBe("30"); expect((await result.json()).error.code).toBe("AI_RATE_LIMITED");
    const imported = vi.spyOn(aiLessonService, "importAiLessonDraft").mockResolvedValue({ lessonId: "lesson", replayed: false });
    const receipt = await handleAiLessonRequest(new NextRequest("https://local/api", { method: "POST", body: JSON.stringify({ confirmed: true }) }), "import"); expect(receipt.status).toBe(200); expect(imported).toHaveBeenCalledOnce();
  });
  it("rejects invalid request IDs before invoking the provider", async () => {
    const spy = vi.spyOn(aiLessonService, "generateDraft");
    const result = await handleAiLessonRequest(new NextRequest("https://local/api", { method: "POST", body: JSON.stringify({ input, target, requestId: "database-id" }) }), "generate");
    expect(result.status).toBe(400); expect(spy).not.toHaveBeenCalled();
  });
});
