import { LessonBlockDiscriminatedSchema } from "@/modules/lessons/lesson-block.schema";
import type { VocabularyBankEntry } from "@/modules/lessons/lesson-content";
import type { AiContentBlock, AiLessonDraft } from "./ai-lesson.schema";
import { ValidationError } from "@/shared/errors/domain-errors";

export function remapAiVocabularyReferences(block: AiContentBlock, ids: ReadonlyMap<string, string>) {
  if (block.type !== "VOCABULARY") return LessonBlockDiscriminatedSchema.parse(block);
  return LessonBlockDiscriminatedSchema.parse({ type: block.type, content: { title: block.content.title, vocabularyIds: block.content.vocabularyClientIds.map((clientId) => {
    const id = ids.get(clientId);
    if (!id) throw new ValidationError("Thiếu ánh xạ từ vựng của bản nháp.");
    return id;
  }) } });
}
export function aiVocabularyBank(draft: AiLessonDraft): VocabularyBankEntry[] {
  return draft.vocabulary.map((v) => ({ id: v.clientId, hangul: v.hangul, romanization: v.romanization, vietnameseMeaning: v.vietnamese, englishMeaning: v.english ?? "", audioUrl: v.audioUrl, partOfSpeech: v.partOfSpeech, difficulty: v.difficulty, tags: v.tags, exampleSentenceHangul: v.exampleSentenceHangul ?? null, exampleSentenceVi: v.exampleSentenceVi ?? null }));
}
