import { z } from "zod";
import { QuestionFormSchema } from "@/modules/admin/admin.schema";
import { QuestionVariantSchema } from "@/modules/exercises/question.schema";
import { TextBlockContentSchema, HangulBlockContentSchema, GrammarBlockContentSchema, ExampleBlockContentSchema, DialogueBlockContentSchema, AudioBlockContentSchema, ImageBlockContentSchema, CalloutBlockContentSchema } from "@/modules/lessons/lesson-block.schema";
import { AudioUrlSchema } from "@/shared/validation/audio-url";
import type { AiGenerationMetadata } from "./ai-generation.types";

export const AI_PAYLOAD_LIMIT = 512 * 1024;
const text = z.string().trim().min(1);
const clientId = text.max(100).regex(/^[a-z][a-z0-9_-]*$/i, "clientId phải là tên tạm, không phải database ID").refine((id) => !z.uuid().safeParse(id).success, "Không dùng database UUID làm clientId");
const order = z.number().int().min(0).max(10000);
const tags = z.array(text.max(100)).max(50);
export const AiLessonGenerateInputSchema = z.object({
  topic: text.max(1000), level: text.max(100), lessonNumber: z.number().int().positive().max(10000).nullable(),
  duration: z.number().int().min(1).max(180).nullable(), targetAudience: z.string().max(1000).nullable(), notes: z.string().max(4000).nullable(),
}).strict();
export type AiLessonGenerateInput = z.infer<typeof AiLessonGenerateInputSchema>;

const blockBase = { clientId, order };
export const AiContentBlockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("TEXT"), content: TextBlockContentSchema }).strict(),
  z.object({ ...blockBase, type: z.literal("HANGUL"), content: HangulBlockContentSchema }).strict(),
  z.object({ ...blockBase, type: z.literal("VOCABULARY"), content: z.object({ title: z.string().optional(), vocabularyClientIds: z.array(clientId).min(1).max(200) }).strict() }).strict(),
  z.object({ ...blockBase, type: z.literal("GRAMMAR"), content: GrammarBlockContentSchema }).strict(),
  z.object({ ...blockBase, type: z.literal("EXAMPLE"), content: ExampleBlockContentSchema }).strict(),
  z.object({ ...blockBase, type: z.literal("DIALOGUE"), content: DialogueBlockContentSchema }).strict(),
  z.object({ ...blockBase, type: z.literal("AUDIO"), content: AudioBlockContentSchema }).strict(),
  z.object({ ...blockBase, type: z.literal("IMAGE"), content: ImageBlockContentSchema }).strict(),
  z.object({ ...blockBase, type: z.literal("CALLOUT"), content: CalloutBlockContentSchema }).strict(),
]);
export type AiContentBlock = z.infer<typeof AiContentBlockSchema>;

const AiQuestionFieldsSchema = z.object({
  clientId, order, type: z.enum(["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "FILL_BLANK", "MATCHING", "ORDERING", "LISTENING_CHOICE", "TRANSLATION", "WRITING", "PRONUNCIATION", "ARRANGE_SENTENCE"]),
  prompt: text.max(4000), audioUrl: AudioUrlSchema.nullable(), correctAnswer: z.string().max(4000).nullable(), explanation: z.string().max(4000).nullable(),
  content: z.record(z.string(), z.unknown()),
  options: z.array(z.object({ text: text.max(4000), isCorrect: z.boolean(), explanation: z.string().max(4000).nullable().optional() }).strict()).max(50),
}).strict().superRefine((q, ctx) => {
  const result = QuestionFormSchema.safeParse({ ...q, exerciseId: "draft", displayOrder: q.order });
  if (!result.success) result.error.issues.forEach((issue) => ctx.addIssue({ code: "custom", path: issue.path, message: issue.message }));
  if (!["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "LISTENING_CHOICE", "ARRANGE_SENTENCE"].includes(q.type) && q.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Loại câu này không có lựa chọn" });
  if (["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "LISTENING_CHOICE"].includes(q.type) && new Set(q.options.map((o) => o.text)).size !== q.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Không lặp nội dung lựa chọn" });
  if (q.type === "FILL_BLANK" && q.correctAnswer !== null && Array.isArray(q.content.answers) && !q.content.answers.includes(q.correctAnswer)) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "Đáp án phải thuộc content.answers" });
  if (!["FILL_BLANK", "ARRANGE_SENTENCE"].includes(q.type) && q.correctAnswer !== null) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "Đáp án của loại câu này nằm trong content/options" });
});
export const AiQuestionSchema = AiQuestionFieldsSchema.and(QuestionVariantSchema);
export type AiQuestion = z.infer<typeof AiQuestionSchema>;
export const AiVocabularySchema = z.object({
  clientId, hangul: text.max(100), romanization: text.max(100), vietnamese: text.max(200), english: z.string().max(200).nullable(),
  partOfSpeech: z.string().max(50).nullable(), audioUrl: AudioUrlSchema.nullable(), difficulty: z.number().int().min(1).max(5).nullable(), tags,
  exampleSentenceHangul: z.string().max(500).nullable().optional(), exampleSentenceVi: z.string().max(500).nullable().optional(),
}).strict();
export const AiLessonDraftSchema = z.object({
  lesson: z.object({ title: text.max(200), slug: text.max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), summary: z.string().max(10000), estimatedDuration: z.number().int().min(0).max(180), level: text.max(100), tags }).strict(),
  learningObjectives: z.array(text.max(500)).min(1).max(100), contentBlocks: z.array(AiContentBlockSchema).min(1).max(100), vocabulary: z.array(AiVocabularySchema).max(200),
  exercises: z.array(z.object({ clientId, title: text.max(200), description: z.string().max(500).nullable(), order, questions: z.array(AiQuestionSchema).min(1).max(100) }).strict()).max(30),
}).strict().superRefine((draft, ctx) => {
  if (draft.exercises.reduce((n, e) => n + e.questions.length, 0) > 200) ctx.addIssue({ code: "custom", path: ["exercises"], message: "Một lần nhập tối đa 200 câu hỏi" });
  const ids = new Set<string>();
  const check = (items: { clientId: string; order?: number }[], path: (string | number)[]) => {
    const orders = new Set<number>();
    items.forEach((item, i) => {
      if (ids.has(item.clientId)) ctx.addIssue({ code: "custom", path: [...path, i, "clientId"], message: "clientId bị trùng" });
      ids.add(item.clientId);
      if (item.order !== undefined) {
        if (orders.has(item.order)) ctx.addIssue({ code: "custom", path: [...path, i, "order"], message: "Thứ tự bị trùng" });
        orders.add(item.order);
      }
    });
  };
  check(draft.contentBlocks, ["contentBlocks"]); check(draft.vocabulary, ["vocabulary"]); check(draft.exercises, ["exercises"]);
  draft.exercises.forEach((e, i) => check(e.questions, ["exercises", i, "questions"]));
  const words = new Set(draft.vocabulary.map((v) => v.clientId));
  draft.contentBlocks.forEach((b, i) => {
    if (b.type !== "VOCABULARY") return;
    const seen = new Set<string>();
    b.content.vocabularyClientIds.forEach((id, j) => {
      if (!words.has(id) || seen.has(id)) ctx.addIssue({ code: "custom", path: ["contentBlocks", i, "content", "vocabularyClientIds", j], message: "Tham chiếu từ vựng không tồn tại hoặc bị trùng" });
      seen.add(id);
    });
  });
});
export type AiLessonDraft = z.infer<typeof AiLessonDraftSchema>;
export interface AiLessonIssue { code: string; path: string; message: string; severity: "ERROR" | "WARNING" | "INFO" }
export interface AiLessonValidationResult { valid: boolean; schemaValid: boolean; errors: AiLessonIssue[]; warnings: AiLessonIssue[]; info: AiLessonIssue[] }
export const AiLessonTargetSchema = z.discriminatedUnion("mode", [
  // Prisma IDs are strings; seeded/legacy records are not necessarily UUIDs.
  z.object({ mode: z.literal("NEW"), chapterId: text.max(200) }).strict(),
  z.object({ mode: z.literal("APPEND"), lessonId: text.max(200) }).strict(),
  z.object({ mode: z.literal("REPLACE"), lessonId: text.max(200) }).strict(),
]);
export type AiLessonTarget = z.infer<typeof AiLessonTargetSchema>;
export const AiLessonImportPayloadSchema = z.object({ target: AiLessonTargetSchema, draft: z.unknown(), validationToken: text.max(1000), generationToken: text.max(2000).optional(), idempotencyKey: z.string().uuid(), confirmed: z.literal(true), replaceConfirmed: z.boolean() }).strict();
export type AiLessonImportPayload = Omit<z.infer<typeof AiLessonImportPayloadSchema>, "draft"> & { draft: AiLessonDraft };
export interface AiLessonPreview { draft: AiLessonDraft | null; validation: AiLessonValidationResult; validationToken: string | null; requestId?: string; generation?: AiGenerationMetadata; generationToken?: string; errorCode?: "AI_SCHEMA_VALIDATION_FAILED" }
