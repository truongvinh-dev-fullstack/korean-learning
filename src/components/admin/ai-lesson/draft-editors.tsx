"use client";

import { useState } from "react";
import { z } from "zod";
import { ContentBlockFields } from "@/components/admin/lesson-detail/content-block-fields";
import { VocabularyEditor } from "@/components/admin/lesson-detail/vocabulary-editor";
import { QuestionEditor } from "@/components/admin/lesson-detail/question-editor";
import { EditorModal, Feedback, Field, primaryClass } from "@/components/admin/lesson-detail/form-controls";
import { issueErrors, type FieldErrors } from "@/modules/admin/admin.client";
import { mapVocabularyDtoToForm } from "@/modules/admin/lesson-detail.mapper";
import { AiContentBlockSchema, AiVocabularySchema, AiQuestionSchema, type AiContentBlock, type AiLessonDraft, type AiQuestion } from "@/modules/ai-lessons/ai-lesson.schema";
import { remapAiVocabularyReferences, aiVocabularyBank } from "@/modules/ai-lessons/ai-lesson.mapper";
import { updateContentBlockTitle } from "@/modules/lessons/lesson-content";

export function DraftBlockEditor({ block, draft, onClose, onSave }: { block: AiContentBlock; draft: AiLessonDraft; onClose: () => void; onSave: (block: AiContentBlock) => void }) {
  const [form, setForm] = useState(() => remapAiVocabularyReferences(block, new Map(draft.vocabulary.map((v) => [v.clientId, v.clientId]))));
  const [errors, setErrors] = useState<FieldErrors>({});
  function save() {
    const value = { clientId: block.clientId, order: block.order, type: form.type, content: form.type === "VOCABULARY" ? { title: form.content.title, vocabularyClientIds: form.content.vocabularyIds ?? [] } : form.content };
    const parsed = AiContentBlockSchema.safeParse(value);
    if (!parsed.success) { setErrors(issueErrors(parsed.error.issues)); return; }
    onSave(parsed.data);
  }
  return <EditorModal title="Sửa khối trong bản nháp AI" onClose={onClose}>
    <Field label="Tiêu đề khối" value={form.content.title} onChange={(title) => setForm(updateContentBlockTitle(form, title))} />
    <ContentBlockFields form={form} onChange={setForm} vocabulary={aiVocabularyBank(draft)} errors={errors} />
    <Feedback error={Object.values(errors).join("; ")} /><button type="button" className={primaryClass} onClick={save}>Áp dụng vào bản nháp</button>
  </EditorModal>;
}
export function DraftVocabularyEditor({ word, onClose, onSave }: { word: AiLessonDraft["vocabulary"][number]; onClose: () => void; onSave: (word: AiLessonDraft["vocabulary"][number]) => void }) {
  const [form, setForm] = useState(() => mapVocabularyDtoToForm({ id: word.clientId, lessonId: "draft", hangul: word.hangul, romanization: word.romanization, vietnameseMeaning: word.vietnamese, englishMeaning: word.english ?? "", partOfSpeech: word.partOfSpeech, audioUrl: word.audioUrl, difficulty: word.difficulty, tags: word.tags, displayOrder: 0, exampleSentenceHangul: word.exampleSentenceHangul ?? null, exampleSentenceVi: word.exampleSentenceVi ?? null }));
  const [errors, setErrors] = useState<FieldErrors>({});
  function save() {
    const result = AiVocabularySchema.safeParse({ ...word, hangul: form.hangul.trim(), romanization: form.romanization.trim(), vietnamese: form.vietnameseMeaning.trim(), english: form.englishMeaning.trim() || null, partOfSpeech: form.partOfSpeech.trim() || null, audioUrl: form.audioUrl.trim() || null, difficulty: form.difficulty, tags: form.tags, exampleSentenceHangul: form.exampleSentenceHangul.trim() || null, exampleSentenceVi: form.exampleSentenceVi.trim() || null });
    if (!result.success) { setErrors(issueErrors(result.error.issues)); return; }
    onSave(result.data);
  }
  return <EditorModal title="Sửa từ trong bản nháp AI" onClose={onClose}><VocabularyEditor form={form} onChange={setForm} errors={errors} />
    <Feedback error={Object.values(errors).join("; ")} /><button type="button" className={primaryClass} onClick={save}>Áp dụng vào bản nháp</button></EditorModal>;
}
export function DraftQuestionEditor({ question, onClose, onSave }: { question: AiQuestion; onClose: () => void; onSave: (question: AiQuestion) => void }) {
  const [errors, setErrors] = useState<FieldErrors>({}); const [error, setError] = useState<string | null>(null);
  return <QuestionEditor exerciseId="draft" question={{ ...question, id: question.clientId, exerciseId: "draft", displayOrder: question.order, options: question.options.map((o, displayOrder) => ({ ...o, displayOrder })) }} busy={false} error={error} errors={errors} onErrors={setErrors} onClose={onClose}
    onSave={async (payload) => {
      try {
        const result = AiQuestionSchema.parse({ clientId: question.clientId, order: question.order, type: payload.type, prompt: payload.prompt, audioUrl: payload.audioUrl ?? null, correctAnswer: payload.correctAnswer ?? null, explanation: payload.explanation ?? null, content: payload.content, options: payload.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, explanation: o.explanation ?? null })) });
        onSave(result);
      } catch (cause) { if (cause instanceof z.ZodError) setErrors(issueErrors(cause.issues)); else setError("Không áp dụng được câu hỏi vào bản nháp."); }
    }} />;
}
