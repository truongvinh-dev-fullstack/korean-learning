import { z } from "zod";
import { AudioUrlSchema } from "@/shared/validation/audio-url";

// 1. Text Block
export const TextBlockContentSchema = z.object({
  title: z.string().optional(),
  markdown: z.string().min(1, "Markdown text content cannot be empty"),
}).passthrough();
export type TextBlockContent = z.infer<typeof TextBlockContentSchema>;

// 2. Hangul Block (individual letters, syllable construction, stroke guides)
export const HangulItemSchema = z.object({
  char: z.string().min(1),
  name: z.string().optional(),
  romanization: z.string().min(1),
  strokeCount: z.number().int().positive().optional(),
  soundHint: z.string().optional(),
  audioUrl: AudioUrlSchema.optional(),
  explanation: z.string().optional(),
  strokeOrder: z.array(z.string().trim().min(1)).optional().nullable(),
  example: z.object({ hangul: z.string(), romanization: z.string(), vietnamese: z.string() }).passthrough().optional().nullable(),
}).passthrough();
export type HangulItem = z.infer<typeof HangulItemSchema>;

export const HangulBlockContentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  characters: z.array(HangulItemSchema).min(1, "Hangul block must have at least one character"),
}).passthrough();
export type HangulBlockContent = z.infer<typeof HangulBlockContentSchema>;

// 3. Vocabulary Block
export const VocabularyBlockItemSchema = z.object({
  hangul: z.string().min(1),
  romanization: z.string().min(1),
  vietnamese: z.string().min(1),
  english: z.string().optional().nullable(),
  partOfSpeech: z.string().optional(),
  audioUrl: AudioUrlSchema.optional(),
  example: z
    .object({
      korean: z.string().min(1),
      vietnamese: z.string().min(1),
      audioUrl: AudioUrlSchema.optional(),
    }).passthrough()
    .optional().nullable(),
}).passthrough();
export type VocabularyBlockItem = z.infer<typeof VocabularyBlockItemSchema>;

export const VocabularyBlockContentSchema = z.object({
  title: z.string().optional(),
  items: z.array(VocabularyBlockItemSchema).min(1, "Cần ít nhất một từ vựng").optional(),
  vocabularyIds: z.array(z.string().min(1)).min(1, "Chọn ít nhất một từ vựng").optional(),
}).passthrough().refine((value) => !!value.vocabularyIds?.length || !!value.items?.length, {
  message: "Chọn từ trong ngân hàng hoặc giữ danh sách từ vựng cũ", path: ["vocabularyIds"],
}).refine((value) => !value.vocabularyIds || new Set(value.vocabularyIds).size === value.vocabularyIds.length, {
  message: "Không chọn trùng từ vựng", path: ["vocabularyIds"],
}).passthrough();
export type VocabularyBlockContent = z.infer<typeof VocabularyBlockContentSchema>;

// 4. Grammar Block
export const GrammarExampleSchema = z.object({
  korean: z.string().min(1),
  vietnamese: z.string().min(1),
  note: z.string().optional(),
  audioUrl: AudioUrlSchema.optional(),
  romanization: z.string().optional().nullable(),
}).passthrough();
export type GrammarExample = z.infer<typeof GrammarExampleSchema>;

export const GrammarBlockContentSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const value = raw as Record<string, unknown>;
  return { ...value, pattern: value.pattern ?? value.formula, description: value.description ?? value.explanation };
}, z.object({
  title: z.string().min(1),
  pattern: z.string().trim().min(1, "Cấu trúc không được để trống"),
  description: z.string().trim().min(1, "Giải thích không được để trống"),
  formula: z.string().optional(),
  explanation: z.string().optional(),
  rules: z.array(z.string().trim().min(1)).default([]),
  examples: z.array(GrammarExampleSchema).min(1, "Grammar block must have at least one example"),
}).passthrough());
export type GrammarBlockContent = z.infer<typeof GrammarBlockContentSchema>;

// 5. Dialogue Block
export const DialogueLineSchema = z.object({
  speaker: z.string().min(1),
  korean: z.string().min(1),
  vietnamese: z.string().min(1),
  audioUrl: AudioUrlSchema.optional(),
  romanization: z.string().optional().nullable(),
}).passthrough();
export type DialogueLine = z.infer<typeof DialogueLineSchema>;

export const DialogueBlockContentSchema = z.object({
  title: z.string().optional(),
  audioUrl: AudioUrlSchema.optional(),
  lines: z.array(DialogueLineSchema).min(1, "Dialogue block must have at least one line"),
}).passthrough();
export type DialogueBlockContent = z.infer<typeof DialogueBlockContentSchema>;

// 6. Audio Block
export const AudioBlockContentSchema = z.object({
  audioUrl: AudioUrlSchema.refine((value) => value.length > 0, "Audio URL is required"),
  title: z.string().optional(),
  caption: z.string().optional(),
  transcript: z.string().optional().nullable(),
}).passthrough();
export type AudioBlockContent = z.infer<typeof AudioBlockContentSchema>;

// 7. Callout Block
export const CalloutVariantSchema = z.enum(["info", "warning", "tip", "note", "remember", "culture", "topik", "common_mistake"]);
export type CalloutVariant = z.infer<typeof CalloutVariantSchema>;

export const CalloutBlockContentSchema = z.object({
  variant: CalloutVariantSchema.default("info"),
  title: z.string().optional(),
  message: z.string().min(1, "Callout message cannot be empty"),
}).passthrough();
export type CalloutBlockContent = z.infer<typeof CalloutBlockContentSchema>;

export const ExampleBlockContentSchema = z.object({
  title: z.string().optional(),
  items: z.array(GrammarExampleSchema).min(1, "Cần ít nhất một ví dụ"),
}).passthrough();
export const ImageBlockContentSchema = z.object({
  title: z.string().optional(),
  imageUrl: AudioUrlSchema.refine((value) => value.length > 0, "Đường dẫn hình ảnh không được để trống"),
  caption: z.string().optional(),
}).passthrough();

// Discriminated Schema for all blocks
export const LessonBlockContentMap = {
  TEXT: TextBlockContentSchema,
  HANGUL: HangulBlockContentSchema,
  VOCABULARY: VocabularyBlockContentSchema,
  GRAMMAR: GrammarBlockContentSchema,
  DIALOGUE: DialogueBlockContentSchema,
  AUDIO: AudioBlockContentSchema,
  CALLOUT: CalloutBlockContentSchema,
  EXAMPLE: ExampleBlockContentSchema,
  IMAGE: ImageBlockContentSchema,
} as const;

export type SupportedBlockType = keyof typeof LessonBlockContentMap;

export const LessonBlockDiscriminatedSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("TEXT"), content: TextBlockContentSchema }),
  z.object({ type: z.literal("HANGUL"), content: HangulBlockContentSchema }),
  z.object({ type: z.literal("VOCABULARY"), content: VocabularyBlockContentSchema }),
  z.object({ type: z.literal("GRAMMAR"), content: GrammarBlockContentSchema }),
  z.object({ type: z.literal("DIALOGUE"), content: DialogueBlockContentSchema }),
  z.object({ type: z.literal("AUDIO"), content: AudioBlockContentSchema }),
  z.object({ type: z.literal("CALLOUT"), content: CalloutBlockContentSchema }),
  z.object({ type: z.literal("EXAMPLE"), content: ExampleBlockContentSchema }),
  z.object({ type: z.literal("IMAGE"), content: ImageBlockContentSchema }),
]);

export type DiscriminatedLessonBlock = z.infer<typeof LessonBlockDiscriminatedSchema>;

/**
 * Validates and safely parses JSON content according to its block type.
 * Throws ZodError if validation fails.
 */
export function validateBlockContent<T extends SupportedBlockType>(
  type: T,
  content: unknown
): z.infer<(typeof LessonBlockContentMap)[T]> {
  const schema = LessonBlockContentMap[type];
  if (!schema) {
    throw new Error(`Unsupported block type: ${String(type)}`);
  }
  return schema.parse(content) as z.infer<(typeof LessonBlockContentMap)[T]>;
}

/**
 * Validates a complete raw database LessonBlock record into a strongly-typed discriminated block.
 */
export function validateLessonBlockRecord(rawBlock: {
  id: string;
  lessonId: string;
  type: string;
  displayOrder: number;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const parsed = LessonBlockDiscriminatedSchema.parse({
    type: rawBlock.type,
    content: rawBlock.content,
  });

  return {
    id: rawBlock.id,
    lessonId: rawBlock.lessonId,
    displayOrder: rawBlock.displayOrder,
    createdAt: rawBlock.createdAt,
    updatedAt: rawBlock.updatedAt,
    ...parsed,
  };
}

export type ValidatedLessonBlock = ReturnType<typeof validateLessonBlockRecord>;
