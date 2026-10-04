import { describe, it, expect, vi, afterEach } from "vitest";
import valid from "../docs/examples/ai/valid-lesson-generation.json";
import invalidKnowledge from "../docs/examples/ai/invalid-knowledge-generation.json";
import invalidSchema from "../docs/examples/ai/invalid-schema-generation.json";
import { parseAiLessonDraft } from "@/modules/ai-lessons/ai-lesson-normalizer";
import { AiQuestionSchema, type AiLessonDraft } from "@/modules/ai-lessons/ai-lesson.schema";
import { buildKnowledgeIndex, validateLessonKnowledge } from "@/modules/ai-lessons/lesson-knowledge-validator";
import { HttpLessonAiProvider, MockLessonAiProvider, getLessonAiProvider, readLimitedJson, AI_LESSON_CONTRACT } from "@/modules/ai-lessons/lesson-ai-provider";
import { AiLessonService } from "@/modules/ai-lessons/ai-lesson.service";
import { randomUUID } from "node:crypto";

const input = { topic: "10 nguyên âm cơ bản", level: "BEGINNER_1", lessonNumber: 1, duration: 20, targetAudience: null, notes: null };
function draft(): AiLessonDraft { const parsed = parseAiLessonDraft(valid); if (!parsed.draft) throw new Error(JSON.stringify(parsed.validation)); return parsed.draft; }
const base = { clientId: "question-test", order: 0, prompt: "Câu hỏi", audioUrl: null, correctAnswer: null, explanation: null, options: [] };
function onlyQuestion(value: unknown) { const d = draft(); d.exercises[0].questions = [AiQuestionSchema.parse(value)]; return d; }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("AI contract: untrusted output", () => {
  it("parses valid JSON with temporary references and preserves Korean Unicode", () => {
    const result = parseAiLessonDraft(JSON.stringify(valid)); expect(result.validation.schemaValid).toBe(true); expect(result.draft?.vocabulary[0].hangul).toBe("아이");
    expect(result.draft?.contentBlocks[1].type).toBe("HANGUL");
  });
  it.each(["{bad json", invalidSchema, { ...valid, learningObjectives: undefined }, { ...valid, id: randomUUID() }])("rejects malformed JSON, duplicate order, missing fields and DB entities", (value) => {
    const result = parseAiLessonDraft(value); expect(result.draft).toBeNull(); expect(result.validation.schemaValid).toBe(false);
  });
  it("rejects duplicate clientIds across different sections", () => {
    const value = structuredClone(valid); value.vocabulary[0].clientId = value.contentBlocks[0].clientId; expect(parseAiLessonDraft(value).validation.errors.some((i) => i.message.includes("trùng"))).toBe(true);
  });
  it("rejects dangling and duplicate vocabulary references", () => {
    const value = draft(); const b = value.contentBlocks.find((b) => b.type === "VOCABULARY"); if (!b || b.type !== "VOCABULARY") throw new Error();
    b.content.vocabularyClientIds = ["missing-word"]; expect(parseAiLessonDraft(value).draft).toBeNull();
    b.content.vocabularyClientIds = [value.vocabulary[0].clientId, value.vocabulary[0].clientId]; expect(parseAiLessonDraft(value).draft).toBeNull();
  });
  it("rejects DB vocabularyIds and UUID clientIds", () => {
    const value = structuredClone(valid); expect(parseAiLessonDraft({ ...value, vocabulary: [{ ...value.vocabulary[0], clientId: "a1234567-1234-4234-8234-123456789012" }] }).draft).toBeNull();
    expect(parseAiLessonDraft({ ...value, contentBlocks: [{ clientId: "block-x", order: 0, type: "VOCABULARY", content: { vocabularyIds: [randomUUID()] } }] }).draft).toBeNull();
  });
  it("rejects unsupported block/question types and invalid choice answer count", () => {
    const value = structuredClone(valid); value.contentBlocks[0].type = "UNSUPPORTED"; expect(parseAiLessonDraft(value).draft).toBeNull();
    const d = structuredClone(valid); d.exercises[0].questions[0].type = "UNSUPPORTED"; expect(parseAiLessonDraft(d).draft).toBeNull();
    const d2 = structuredClone(valid); d2.exercises[0].questions[0].options[0].isCorrect = false; expect(parseAiLessonDraft(d2).draft).toBeNull();
  });
  it("rejects wrong structured answers and nonboolean TRUE_FALSE", () => {
    expect(AiQuestionSchema.safeParse({ ...base, type: "ORDERING", content: { items: [{ id: "a", text: "아이" }, { id: "b", text: "오이" }], correctOrder: ["a", "missing"] } }).success).toBe(false);
    expect(AiQuestionSchema.safeParse({ ...base, type: "TRUE_FALSE", content: { correctAnswer: "true" } }).success).toBe(false);
    expect(AiQuestionSchema.safeParse({ ...base, type: "FILL_BLANK", correctAnswer: "사과", content: { answers: ["아이"] } }).success).toBe(false);
  });
  it("normalizes trim/slug/tags/order/nullables after rejecting duplicate ranks", () => {
    const value = structuredClone(valid); value.lesson.slug = "  BÀI 1 Nguyên Âm  "; value.lesson.tags = [" hangul ", "hangul"]; value.vocabulary[0].english = " "; value.contentBlocks.forEach((b, i) => { b.order = i * 10 + 10; });
    const d = parseAiLessonDraft(value).draft; expect(d?.lesson.slug).toBe("bai-1-nguyen-am"); expect(d?.lesson.tags).toEqual(["hangul"]); expect(d?.vocabulary[0].english).toBeNull(); expect(d?.contentBlocks.map((b) => b.order)).toEqual([0, 1, 2, 3, 4]);
  });
  it("limits output size and nesting", () => {
    expect(parseAiLessonDraft("x".repeat(512 * 1024 + 1)).draft).toBeNull();
    let nested: unknown = {}; for (let i = 0; i < 40; i++) nested = { nested }; expect(parseAiLessonDraft(nested).validation.valid).toBe(false);
  });
  it("preserves empty optional block fields while normalizing nullable question fields", () => {
    const d = draft(); const b = d.contentBlocks[1]; if (b.type === "HANGUL") { b.content.description = " "; b.content.characters[0].audioUrl = " "; }
    d.exercises[0].questions[0].explanation = " "; const result = parseAiLessonDraft(d); expect(result.validation.valid).toBe(true); expect(result.draft?.exercises[0].questions[0].explanation).toBeNull();
  });
});

describe("AI knowledge coverage", () => {
  it("indexes bank, characters, examples and audio without indexing questions", () => {
    const index = buildKnowledgeIndex(draft()); expect(index.hangulCharacters.has("ㅏ")).toBe(true); expect(index.vocabulary.has("우유")).toBe(true); expect(index.examples.has("유")).toBe(true); expect(index.listeningAssets.has("/audio/lessons/korean-vowels.ogg")).toBe(true);
  });
  it("permits valid questions with warning-only audio review", () => {
    const result = validateLessonKnowledge(draft(), new Set(["/audio/exercises/vowel-a.ogg", "/audio/vocab/ai.ogg", "/audio/lessons/korean-vowels.ogg"])); expect(result.valid).toBe(true); expect(result.warnings.some((i) => i.code === "QUESTION_AUDIO_TRANSCRIPT_REVIEW")).toBe(true);
  });
  it("rejects an untaught correct vocabulary target at its question path", () => {
    const d = parseAiLessonDraft(invalidKnowledge).draft; if (!d) throw new Error(); const result = validateLessonKnowledge(d); expect(result.errors).toContainEqual(expect.objectContaining({ code: "QUESTION_UNKNOWN_VOCABULARY", path: "exercises.0.questions.0", severity: "ERROR" }));
  });
  it("rejects an untaught Hangul character", () => {
    const d = onlyQuestion({ ...base, type: "MULTIPLE_CHOICE", content: {}, options: [{ text: "ㄱ", isCorrect: true }, { text: "ㅏ", isCorrect: false }] }); expect(validateLessonKnowledge(d).errors[0].code).toBe("QUESTION_UNKNOWN_HANGUL");
  });
  it("checks Korean prompt targets when answers are Vietnamese", () => {
    const d = onlyQuestion({ ...base, prompt: "사과 có nghĩa gì?", type: "MULTIPLE_CHOICE", content: {}, options: [{ text: "Sữa", isCorrect: true }, { text: "Em bé", isCorrect: false }] }); expect(validateLessonKnowledge(d).valid).toBe(false);
  });
  it("checks correct meaning against a taught word", () => {
    const d = onlyQuestion({ ...base, prompt: "우유 có nghĩa gì?", type: "MULTIPLE_CHOICE", content: {}, options: [{ text: "Sữa", isCorrect: true }, { text: "Em bé", isCorrect: false }] }); expect(validateLessonKnowledge(d).valid).toBe(true);
    d.exercises[0].questions[0].options[0].text = "Con cá"; expect(validateLessonKnowledge(d).valid).toBe(false);
  });
  it("rejects a taught but wrong word/romanization and meaning targets absent from the bank", () => {
    const d = draft(); d.exercises[0].questions[0].options[0].text = "우유"; expect(validateLessonKnowledge(d).errors.some((i) => i.code === "QUESTION_MEANING_MISMATCH")).toBe(true);
    const q = d.exercises[0].questions[1]; q.options[1].text = "ㅜ"; expect(validateLessonKnowledge(d).errors.some((i) => i.code === "QUESTION_ROMANIZATION_MISMATCH")).toBe(true);
    const textOnly = onlyQuestion({ ...base, prompt: "Từ nào có nghĩa là táo?", type: "MULTIPLE_CHOICE", content: {}, options: [{ text: "사과", isCorrect: true }, { text: "우유", isCorrect: false }] });
    textOnly.contentBlocks.push({ type: "TEXT", clientId: "text-word", order: 5, content: { markdown: "사과" } }); expect(validateLessonKnowledge(textOnly).errors.some((i) => i.code === "QUESTION_UNKNOWN_VOCABULARY")).toBe(true);
  });
  it("checks fill-blank and listening asset existence", () => {
    expect(validateLessonKnowledge(onlyQuestion({ ...base, type: "FILL_BLANK", content: { answers: ["사과"] } })).valid).toBe(false);
    const d = draft(); expect(validateLessonKnowledge(d, new Set()).errors.some((i) => i.code === "QUESTION_AUDIO_MISSING")).toBe(true);
  });
  it("checks matching word/meaning pairs and ordering context", () => {
    const matching = onlyQuestion({ ...base, type: "MATCHING", content: { pairs: [{ leftId: "l1", rightId: "r1", left: "우유", right: "Sữa" }, { leftId: "l2", rightId: "r2", left: "오이", right: "Dưa chuột" }] } }); expect(validateLessonKnowledge(matching).valid).toBe(true);
    const q = matching.exercises[0].questions[0]; if (q.type === "MATCHING") q.content.pairs[0].right = "Con cá"; expect(validateLessonKnowledge(matching).valid).toBe(false);
    const ordering = onlyQuestion({ ...base, type: "ORDERING", content: { items: [{ id: "a", text: "저는" }, { id: "b", text: "학생입니다" }], correctOrder: ["a", "b"] } }); expect(validateLessonKnowledge(ordering).valid).toBe(false);
    ordering.contentBlocks.push({ clientId: "example-new", order: 5, type: "EXAMPLE", content: { items: [{ korean: "저는 학생입니다.", vietnamese: "Tôi là học sinh." }] } }); expect(validateLessonKnowledge(ordering).valid).toBe(true);
  });
  it("checks translation source, pronunciation target, manual writing and warning-only TRUE_FALSE", () => {
    expect(validateLessonKnowledge(onlyQuestion({ ...base, type: "TRANSLATION", content: { source: "사과", acceptedAnswers: ["Táo"] } })).valid).toBe(false);
    expect(validateLessonKnowledge(onlyQuestion({ ...base, type: "TRANSLATION", content: { source: "Sữa", acceptedAnswers: ["우유"] } })).valid).toBe(true);
    expect(validateLessonKnowledge(onlyQuestion({ ...base, type: "PRONUNCIATION", content: { prompt: "Đọc 사과", gradingMode: "MANUAL" } })).valid).toBe(false);
    expect(validateLessonKnowledge(onlyQuestion({ ...base, type: "WRITING", content: { prompt: "Viết", gradingMode: "MANUAL" } })).valid).toBe(true);
    const tf = validateLessonKnowledge(onlyQuestion({ ...base, type: "TRUE_FALSE", content: { correctAnswer: true } })); expect(tf.valid).toBe(true); expect(tf.errors).toEqual([]); expect(tf.warnings[0].code).toBe("QUESTION_SEMANTIC_REVIEW");
  });
});

describe("AI provider/security boundary", () => {
  it("uses a deterministic mock and refuses it in production", async () => {
    expect(await new MockLessonAiProvider().generateLesson(input)).toEqual(valid); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("AI_LESSON_PROVIDER", "mock"); expect(() => getLessonAiProvider()).toThrow("Chưa cấu hình"); await expect(new MockLessonAiProvider().generateLesson(input)).rejects.toThrow("production");
  });
  it("exports a full JSON schema and never falls back when HTTP provider fails", async () => {
    expect(AI_LESSON_CONTRACT.schema).toHaveProperty("properties.lesson"); const fetchMock = vi.fn().mockRejectedValue(new Error("api-key-secret-provider-body")); vi.stubGlobal("fetch", fetchMock);
    await expect(new HttpLessonAiProvider("https://ai.example.com", "secret").generateLesson(input)).rejects.toThrow("Dịch vụ AI"); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("sends input/full contract to the configured HTTPS provider and returns JSON unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(valid), { headers: { "Content-Type": "application/json" } })); vi.stubGlobal("fetch", fetchMock);
    expect(await new HttpLessonAiProvider("https://ai.example.com", "server-secret").generateLesson(input)).toEqual(valid);
    const [url, options] = fetchMock.mock.calls[0]; expect(url).toBe("https://ai.example.com"); expect(options.headers.Authorization).toBe("Bearer server-secret"); expect(JSON.parse(options.body)).toMatchObject({ input, contract: { schema: { type: "object" } } });
    fetchMock.mockClear(); await expect(new HttpLessonAiProvider("http://ai.example.com", "server-secret").generateLesson(input)).rejects.toThrow("Dịch vụ AI"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sanitizes arbitrary provider failures and logs no input/content/key", async () => {
    const logs = vi.spyOn(console, "info").mockImplementation(() => {}); const service = new AiLessonService({ generateLesson: async () => { throw new Error("private-token-and-content"); } });
    await expect(service.generateDraft({ id: randomUUID(), role: "ADMIN" }, input, { mode: "NEW", chapterId: randomUUID() })).rejects.toThrow("Không tạo được"); expect(JSON.stringify(logs.mock.calls)).not.toContain("private-token-and-content"); expect(JSON.stringify(logs.mock.calls)).not.toContain(input.topic);
  });
  it("limits chunked request bodies even without content-length", async () => {
    await expect(readLimitedJson(new Response("x".repeat(1025)), 1024)).rejects.toThrow("Payload"); await expect(readLimitedJson(new Response("bad"))).rejects.toThrow("JSON");
  });
});
