import { LessonBlockDiscriminatedSchema, type DiscriminatedLessonBlock, type VocabularyBlockItem, type SupportedBlockType } from "./lesson-block.schema";

export interface VocabularyBankEntry {
  id: string; hangul: string; romanization: string; vietnameseMeaning: string; englishMeaning: string;
  audioUrl?: string | null; partOfSpeech?: string | null; exampleSentenceHangul?: string | null; exampleSentenceVi?: string | null;
  difficulty?: number | null; tags?: string[];
}

export function resolveVocabularyContent(content: Extract<DiscriminatedLessonBlock, { type: "VOCABULARY" }>["content"], bank: readonly (Partial<VocabularyBankEntry> & { hangul: string })[]): VocabularyBlockItem[] {
  if (!content.vocabularyIds) return content.items ?? [];
  return content.vocabularyIds.flatMap((id) => {
    const word = bank.find((entry) => entry.id === id);
    return word ? [{ hangul: word.hangul, romanization: word.romanization ?? "", vietnamese: word.vietnameseMeaning ?? "",
      english: word.englishMeaning, audioUrl: word.audioUrl ?? undefined, partOfSpeech: word.partOfSpeech ?? undefined,
      example: word.exampleSentenceHangul ? { korean: word.exampleSentenceHangul, vietnamese: word.exampleSentenceVi ?? "" } : undefined }] : [];
  });
}

export function createContentBlockForm(type: SupportedBlockType): DiscriminatedLessonBlock {
  switch (type) {
    case "TEXT": return { type, content: { title: "", markdown: "" } };
    case "HANGUL": return { type, content: { title: "", description: "", characters: [] } };
    case "VOCABULARY": return { type, content: { title: "", vocabularyIds: [] } };
    case "GRAMMAR": return { type, content: { title: "", pattern: "", description: "", rules: [], examples: [] } };
    case "EXAMPLE": return { type, content: { title: "", items: [] } };
    case "DIALOGUE": return { type, content: { title: "", lines: [] } };
    case "AUDIO": return { type, content: { title: "", caption: "", audioUrl: "", transcript: "" } };
    case "IMAGE": return { type, content: { title: "", imageUrl: "", caption: "" } };
    case "CALLOUT": return { type, content: { title: "", message: "", variant: "tip" } };
  }
}

export function mapContentBlockDtoToForm(dto: { type: string; content: unknown }): DiscriminatedLessonBlock {
  return LessonBlockDiscriminatedSchema.parse(dto);
}

export function mapContentBlockFormToPayload(form: DiscriminatedLessonBlock) {
  // Keep aliases consistent when editing a legacy grammar block.
  const value = form.type === "GRAMMAR" ? { ...form, content: { ...form.content,
    ...(form.content.formula !== undefined && { formula: form.content.pattern }),
    ...(form.content.explanation !== undefined && { explanation: form.content.description }),
  } } : form;
  return LessonBlockDiscriminatedSchema.parse(value);
}

export function updateContentBlockTitle<T extends DiscriminatedLessonBlock>(form: T, title: string): T {
  return { ...form, content: { ...form.content, title } };
}

const contentFields: Record<SupportedBlockType, readonly string[]> = {
  TEXT: ["markdown"], HANGUL: ["description", "characters"], VOCABULARY: ["items", "vocabularyIds"],
  GRAMMAR: ["pattern", "description", "rules", "examples", "formula", "explanation"], EXAMPLE: ["items"],
  DIALOGUE: ["lines", "audioUrl"], AUDIO: ["audioUrl", "caption", "transcript"], IMAGE: ["imageUrl", "caption"],
  CALLOUT: ["message", "variant"],
};

/** Explicit type changes discard incompatible old fields; ordinary edits keep legacy extensions. */
export function contentForTypeChange(from: SupportedBlockType, to: SupportedBlockType, content: unknown): unknown {
  if (!content || typeof content !== "object" || Array.isArray(content)) return content;
  return Object.fromEntries(Object.entries(content).filter(([key]) => !contentFields[from].includes(key) || contentFields[to].includes(key)));
}

export function contentBlockPreview(form: DiscriminatedLessonBlock): string {
  const c = form.content;
  switch (form.type) {
    case "TEXT": return form.content.markdown.slice(0, 180);
    case "HANGUL": return form.content.characters.map((char) => char.char).join(" · ");
    case "VOCABULARY": return `${form.content.vocabularyIds?.length ?? form.content.items?.length ?? 0} từ vựng`;
    case "GRAMMAR": return `${form.content.pattern} — ${form.content.description}`;
    case "EXAMPLE": return form.content.items.map((item) => item.korean).join(" · ");
    case "DIALOGUE": return form.content.lines.map((line) => `${line.speaker}: ${line.korean}`).join(" · ");
    case "AUDIO": return form.content.caption || "Nghe và luyện phát âm";
    case "IMAGE": return form.content.caption || "Hình ảnh bài giảng";
    case "CALLOUT": return form.content.message;
    default: return c.title ?? "";
  }
}

/** Structured context for future AI generation and knowledge coverage rules (1–3). */
export function buildLessonKnowledgeContext(blocks: readonly DiscriminatedLessonBlock[], vocabulary: readonly VocabularyBankEntry[]) {
  return {
    vocabulary,
    characters: blocks.flatMap((block) => block.type === "HANGUL" ? block.content.characters.map((item) => item.char) : []),
    grammarPatterns: blocks.flatMap((block) => block.type === "GRAMMAR" ? [block.content.pattern] : []),
    contentBlocks: blocks,
  };
}

// AI contracts live in modules/ai-lessons; persistence entities are not provider contracts.
