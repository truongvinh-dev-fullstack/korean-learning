import { AiLessonDraftSchema, AI_PAYLOAD_LIMIT, type AiLessonDraft, type AiLessonValidationResult } from "./ai-lesson.schema";

export function normalizeAiSlug(value: string) {
  return value.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/g, "");
}
function trimTree(raw: unknown, key = "", depth = 0): unknown {
  if (depth > 30) throw new Error("Nội dung lồng quá sâu");
  if (typeof raw === "string") {
    return raw.trim(); // No compatibility normalization or Korean spelling correction.
  }
  if (Array.isArray(raw)) {
    const values = raw.map((v) => trimTree(v, "", depth + 1));
    return key === "tags" ? [...new Set(values)] : values;
  }
  if (raw && typeof raw === "object") return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, trimTree(v, k, depth + 1)]));
  return raw;
}
export function parseAiLessonDraft(raw: unknown): { draft: AiLessonDraft | null; validation: AiLessonValidationResult } {
  const invalid = (message: string) => ({ draft: null, validation: { valid: false, schemaValid: false, errors: [{ code: "AI_SCHEMA_INVALID", path: "draft", message, severity: "ERROR" as const }], warnings: [], info: [] } });
  try {
    if (new TextEncoder().encode(typeof raw === "string" ? raw : JSON.stringify(raw)).length > AI_PAYLOAD_LIMIT) return invalid("Bản nháp vượt giới hạn 512 KB");
    const tree = trimTree(typeof raw === "string" ? JSON.parse(raw) : raw);
    // Null conversion is scoped to nullable fields in the AI contract, not same-named block fields.
    const nullable = (value: unknown, keys: string[]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const object = value as Record<string, unknown>;
        keys.forEach((key) => { if (object[key] === "") object[key] = null; });
      }
    };
    if (tree && typeof tree === "object") {
      const object = tree as Record<string, unknown>;
      if (Array.isArray(object.vocabulary)) object.vocabulary.forEach((v) => nullable(v, ["english", "partOfSpeech", "audioUrl", "exampleSentenceHangul", "exampleSentenceVi"]));
      if (Array.isArray(object.exercises)) object.exercises.forEach((e) => {
        nullable(e, ["description"]);
        if (e && typeof e === "object" && "questions" in e && Array.isArray(e.questions)) e.questions.forEach((q: unknown) => nullable(q, ["audioUrl", "correctAnswer", "explanation"]));
      });
    }
    if (tree && typeof tree === "object" && "lesson" in tree && tree.lesson && typeof tree.lesson === "object" && "slug" in tree.lesson && typeof tree.lesson.slug === "string") tree.lesson.slug = normalizeAiSlug(tree.lesson.slug);
    const parsed = AiLessonDraftSchema.safeParse(tree);
    if (!parsed.success) return { draft: null, validation: { valid: false, schemaValid: false, errors: parsed.error.issues.map((i) => ({ code: "AI_SCHEMA_INVALID", path: i.path.join("."), message: i.message, severity: "ERROR" })), warnings: [], info: [] } };
    const rank = <T extends { order: number }>(items: T[]) => [...items].sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order }));
    const draft = { ...parsed.data, contentBlocks: rank(parsed.data.contentBlocks), exercises: rank(parsed.data.exercises).map((e) => ({ ...e, questions: rank(e.questions) })) };
    return { draft, validation: { valid: true, schemaValid: true, errors: [], warnings: [], info: [] } };
  } catch { return invalid("Không đọc được JSON bản nháp hoặc cấu trúc quá sâu"); }
}
