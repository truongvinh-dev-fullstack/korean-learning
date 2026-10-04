import { z } from "zod";

const text = z.string().trim().min(1, "Không được để trống");
const empty = z.object({});
export const QuestionContentMap = {
  MULTIPLE_CHOICE: empty,
  MULTIPLE_SELECT: empty,
  LISTENING_CHOICE: empty,
  ARRANGE_SENTENCE: empty,
  TRUE_FALSE: z.object({ correctAnswer: z.boolean() }),
  FILL_BLANK: z.object({ answers: z.array(text).min(1, "Cần ít nhất một đáp án"), caseSensitive: z.boolean().default(false) }),
  MATCHING: z.object({ pairs: z.array(z.object({ leftId: text, rightId: text, left: text, right: text })).min(2, "Cần ít nhất hai cặp") })
    .refine((value) => new Set(value.pairs.map((p) => p.leftId)).size === value.pairs.length && new Set(value.pairs.map((p) => p.rightId)).size === value.pairs.length, "ID cặp phải duy nhất"),
  ORDERING: z.object({ items: z.array(z.object({ id: text, text })).min(2, "Cần ít nhất hai mục"), correctOrder: z.array(text).min(2) })
    .refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length &&
      new Set(value.correctOrder).size === value.items.length && value.correctOrder.length === value.items.length &&
      value.correctOrder.every((id) => value.items.some((item) => item.id === id)), { message: "Thứ tự đúng phải chứa mỗi mục đúng một lần", path: ["correctOrder"] }),
  TRANSLATION: z.object({ source: text, acceptedAnswers: z.array(text).min(1, "Cần ít nhất một bản dịch chấp nhận") }),
  WRITING: z.object({ prompt: text, gradingMode: z.literal("MANUAL") }),
  PRONUNCIATION: z.object({ prompt: text, gradingMode: z.literal("MANUAL") }),
} as const;

export type SupportedQuestionType = keyof typeof QuestionContentMap;
export const QuestionVariantSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MULTIPLE_CHOICE"), content: QuestionContentMap.MULTIPLE_CHOICE }),
  z.object({ type: z.literal("MULTIPLE_SELECT"), content: QuestionContentMap.MULTIPLE_SELECT }),
  z.object({ type: z.literal("LISTENING_CHOICE"), content: QuestionContentMap.LISTENING_CHOICE }),
  z.object({ type: z.literal("ARRANGE_SENTENCE"), content: QuestionContentMap.ARRANGE_SENTENCE }),
  z.object({ type: z.literal("TRUE_FALSE"), content: QuestionContentMap.TRUE_FALSE }),
  z.object({ type: z.literal("FILL_BLANK"), content: QuestionContentMap.FILL_BLANK }),
  z.object({ type: z.literal("MATCHING"), content: QuestionContentMap.MATCHING }),
  z.object({ type: z.literal("ORDERING"), content: QuestionContentMap.ORDERING }),
  z.object({ type: z.literal("TRANSLATION"), content: QuestionContentMap.TRANSLATION }),
  z.object({ type: z.literal("WRITING"), content: QuestionContentMap.WRITING }),
  z.object({ type: z.literal("PRONUNCIATION"), content: QuestionContentMap.PRONUNCIATION }),
]);
export type QuestionContent<T extends SupportedQuestionType> = z.infer<(typeof QuestionContentMap)[T]>;
export interface QuestionChoice {
  id?: string; text: string; isCorrect: boolean; explanation?: string | null; displayOrder?: number;
}
export type QuestionDomain = { [T in SupportedQuestionType]: {
  type: T; content: QuestionContent<T>; prompt: string; explanation?: string | null; displayOrder: number;
  options?: QuestionChoice[]; audioUrl?: string | null; correctAnswer?: string | null;
} }[SupportedQuestionType];

/** Legacy fill-blank/arrangement and relational choices need no backfill. */
export function parseQuestionContent<T extends SupportedQuestionType>(type: T, content: unknown, correctAnswer?: string | null): QuestionContent<T> {
  const raw = content ?? (type === "FILL_BLANK" ? { answers: correctAnswer ? [correctAnswer] : [], caseSensitive: false } : {});
  return QuestionContentMap[type].parse(raw) as QuestionContent<T>;
}

export function isManualQuestion(type: string) {
  return type === "WRITING" || type === "PRONUNCIATION";
}
