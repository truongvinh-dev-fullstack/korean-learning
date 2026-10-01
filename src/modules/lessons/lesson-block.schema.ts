import { z } from "zod";
import { AudioUrlSchema } from "@/shared/validation/audio-url";

// 1. Text Block
export const TextBlockContentSchema = z.object({
  title: z.string().optional(),
  markdown: z.string().min(1, "Markdown text content cannot be empty"),
});
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
});
export type HangulItem = z.infer<typeof HangulItemSchema>;

export const HangulBlockContentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  characters: z.array(HangulItemSchema).min(1, "Hangul block must have at least one character"),
});
export type HangulBlockContent = z.infer<typeof HangulBlockContentSchema>;

// 3. Vocabulary Block
export const VocabularyBlockItemSchema = z.object({
  hangul: z.string().min(1),
  romanization: z.string().min(1),
  vietnamese: z.string().min(1),
  english: z.string().min(1),
  partOfSpeech: z.string().optional(),
  audioUrl: AudioUrlSchema.optional(),
  example: z
    .object({
      korean: z.string().min(1),
      vietnamese: z.string().min(1),
      audioUrl: AudioUrlSchema.optional(),
    })
    .optional(),
});
export type VocabularyBlockItem = z.infer<typeof VocabularyBlockItemSchema>;

export const VocabularyBlockContentSchema = z.object({
  title: z.string().optional(),
  items: z.array(VocabularyBlockItemSchema).min(1, "Vocabulary block must contain at least one word"),
});
export type VocabularyBlockContent = z.infer<typeof VocabularyBlockContentSchema>;

// 4. Grammar Block
export const GrammarExampleSchema = z.object({
  korean: z.string().min(1),
  vietnamese: z.string().min(1),
  note: z.string().optional(),
  audioUrl: AudioUrlSchema.optional(),
});
export type GrammarExample = z.infer<typeof GrammarExampleSchema>;

export const GrammarBlockContentSchema = z.object({
  title: z.string().min(1),
  formula: z.string().min(1),
  explanation: z.string().min(1),
  examples: z.array(GrammarExampleSchema).min(1, "Grammar block must have at least one example"),
});
export type GrammarBlockContent = z.infer<typeof GrammarBlockContentSchema>;

// 5. Dialogue Block
export const DialogueLineSchema = z.object({
  speaker: z.string().min(1),
  korean: z.string().min(1),
  vietnamese: z.string().min(1),
  audioUrl: AudioUrlSchema.optional(),
});
export type DialogueLine = z.infer<typeof DialogueLineSchema>;

export const DialogueBlockContentSchema = z.object({
  title: z.string().optional(),
  audioUrl: AudioUrlSchema.optional(),
  lines: z.array(DialogueLineSchema).min(1, "Dialogue block must have at least one line"),
});
export type DialogueBlockContent = z.infer<typeof DialogueBlockContentSchema>;

// 6. Audio Block
export const AudioBlockContentSchema = z.object({
  audioUrl: AudioUrlSchema.refine((value) => value.length > 0, "Audio URL is required"),
  title: z.string().optional(),
  caption: z.string().optional(),
  transcript: z.string().optional(),
});
export type AudioBlockContent = z.infer<typeof AudioBlockContentSchema>;

// 7. Callout Block
export const CalloutVariantSchema = z.enum(["info", "warning", "tip", "note"]);
export type CalloutVariant = z.infer<typeof CalloutVariantSchema>;

export const CalloutBlockContentSchema = z.object({
  variant: CalloutVariantSchema.default("info"),
  title: z.string().optional(),
  message: z.string().min(1, "Callout message cannot be empty"),
});
export type CalloutBlockContent = z.infer<typeof CalloutBlockContentSchema>;

// Discriminated Schema for all blocks
export const LessonBlockContentMap = {
  TEXT: TextBlockContentSchema,
  HANGUL: HangulBlockContentSchema,
  VOCABULARY: VocabularyBlockContentSchema,
  GRAMMAR: GrammarBlockContentSchema,
  DIALOGUE: DialogueBlockContentSchema,
  AUDIO: AudioBlockContentSchema,
  CALLOUT: CalloutBlockContentSchema,
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
