import type { ContentStatus } from "@prisma/client";
import { LessonFormSchema, VocabularyFormSchema, QuestionFormSchema, type QuestionOptionData } from "./admin.schema";
import { parseQuestionContent, QuestionVariantSchema, type QuestionDomain, type SupportedQuestionType } from "@/modules/exercises/question.schema";

export interface LessonInfoDto {
  id: string; chapterId: string; title: string; slug: string; summary: string | null; estimatedMinutes: number;
  status: ContentStatus; displayOrder: number; level?: string | null; tags?: string[];
}
export function mapLessonDtoToForm(dto: LessonInfoDto) {
  return { title: dto.title, slug: dto.slug, summary: dto.summary ?? "", estimatedMinutes: dto.estimatedMinutes,
    status: dto.status, level: dto.level ?? "", tags: dto.tags ?? [] };
}
export function mapLessonFormToPayload(form: ReturnType<typeof mapLessonDtoToForm>) {
  return LessonFormSchema.partial().parse({ ...form, level: form.level || null });
}

export interface VocabularyDto {
  id: string; lessonId: string; hangul: string; romanization: string; vietnameseMeaning: string; englishMeaning: string;
  partOfSpeech: string | null; audioUrl: string | null; exampleSentenceHangul: string | null; exampleSentenceVi: string | null;
  difficulty?: number | null; tags?: string[]; displayOrder: number; _count?: { reviewCards: number };
}
export function mapVocabularyDtoToForm(dto?: VocabularyDto) {
  return { hangul: dto?.hangul ?? "", romanization: dto?.romanization ?? "", vietnameseMeaning: dto?.vietnameseMeaning ?? "",
    englishMeaning: dto?.englishMeaning ?? "", partOfSpeech: dto?.partOfSpeech ?? "", audioUrl: dto?.audioUrl ?? "",
    exampleSentenceHangul: dto?.exampleSentenceHangul ?? "", exampleSentenceVi: dto?.exampleSentenceVi ?? "",
    difficulty: dto?.difficulty ?? null, tags: dto?.tags ?? [] };
}
export function mapVocabularyFormToPayload(lessonId: string, form: ReturnType<typeof mapVocabularyDtoToForm>) {
  return VocabularyFormSchema.parse({ lessonId, ...form, audioUrl: form.audioUrl || null });
}

export interface QuestionDto {
  id: string; exerciseId: string; type: SupportedQuestionType; prompt: string; audioUrl: string | null;
  correctAnswer: string | null; explanation: string | null; displayOrder: number; content?: unknown;
  options: { id?: string; text: string; isCorrect: boolean; explanation?: string | null; displayOrder: number }[];
  _count?: { attemptAnswers: number };
}
export type QuestionFormModel = QuestionDomain & { id?: string; audioUrl: string; correctAnswer: string; options: QuestionOptionData[] };
const choiceOptions = () => [{ text: "", isCorrect: true, displayOrder: 0 }, { text: "", isCorrect: false, displayOrder: 1 }];
export function createQuestionForm(type: SupportedQuestionType = "MULTIPLE_CHOICE"): QuestionFormModel {
  const base = { prompt: "", explanation: "", displayOrder: 0, audioUrl: "", correctAnswer: "", options: choiceOptions() };
  switch (type) {
    case "FILL_BLANK": return { ...base, type, content: { answers: [""], caseSensitive: false } };
    case "TRUE_FALSE": return { ...base, type, content: { correctAnswer: true } };
    case "MATCHING": return { ...base, type, content: { pairs: [] } };
    case "ORDERING": return { ...base, type, content: { items: [], correctOrder: [] } };
    case "TRANSLATION": return { ...base, type, content: { source: "", acceptedAnswers: [""] } };
    case "WRITING": case "PRONUNCIATION": return { ...base, type, content: { prompt: "", gradingMode: "MANUAL" } };
    default: return { ...base, type, content: {} };
  }
}
export function mapQuestionDtoToForm(dto: QuestionDto): QuestionFormModel {
  const variant = QuestionVariantSchema.parse({ type: dto.type, content: parseQuestionContent(dto.type, dto.content, dto.correctAnswer) });
  return { ...dto, audioUrl: dto.audioUrl ?? "", correctAnswer: dto.correctAnswer ?? "", explanation: dto.explanation ?? "", ...variant };
}
export function mapQuestionFormToPayload(exerciseId: string, form: QuestionFormModel) {
  const hasOptions = ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "LISTENING_CHOICE", "ARRANGE_SENTENCE"].includes(form.type);
  return QuestionFormSchema.parse({ ...form, exerciseId, audioUrl: form.audioUrl || null,
    displayOrder: form.id ? form.displayOrder : undefined,
    correctAnswer: form.type === "FILL_BLANK" ? form.content.answers[0] : form.type === "ARRANGE_SENTENCE" ? form.correctAnswer : null,
    explanation: form.explanation || null,
    options: hasOptions ? form.options.map((option, index) => ({ ...option, displayOrder: index })) : [] });
}
