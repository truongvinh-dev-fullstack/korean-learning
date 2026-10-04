"use client";

import { useState } from "react";
import type { AiLessonDraft, AiLessonValidationResult, AiQuestion } from "@/modules/ai-lessons/ai-lesson.schema";
import { aiVocabularyBank, remapAiVocabularyReferences } from "@/modules/ai-lessons/ai-lesson.mapper";
import { contentBlockPreview } from "@/modules/lessons/lesson-content";
import { LessonBlockRenderer } from "@/components/lessons/lesson-block-renderer";
import { BLOCK_LABELS, QUESTION_LABELS } from "@/modules/admin/lesson-detail.constants";
import { Field, StringListEditor, ReorderButtons, moveItem, sectionClass, buttonClass } from "@/components/admin/lesson-detail/form-controls";
import { DraftBlockEditor, DraftVocabularyEditor, DraftQuestionEditor } from "./draft-editors";

export function ValidationIssues({ result, path = "" }: { result: AiLessonValidationResult | null; path?: string }) {
  if (!result) return null;
  return <div className="space-y-1 text-xs" aria-live="polite">{[...result.errors, ...result.warnings].filter((i) => !path || i.path === path || i.path.startsWith(`${path}.`)).map((issue, i) => <p key={`${issue.path}-${i}`} className={issue.severity === "ERROR" ? "text-rose-300" : "text-amber-300"}>
    {issue.severity === "ERROR" ? "✕" : "⚠"} {issue.path}: {issue.message}</p>)}</div>;
}
const rank = <T extends { order: number }>(items: T[]) => items.map((item, order) => ({ ...item, order }));
function DraftQuestionAnswer({ question: q }: { question: AiQuestion }) {
  let text: string;
  switch (q.type) {
    case "TRUE_FALSE": text = `Đáp án: ${q.content.correctAnswer ? "Đúng" : "Sai"}`; break;
    case "FILL_BLANK": text = `Đáp án: ${q.content.answers.join(" / ")}`; break;
    case "MATCHING": text = q.content.pairs.map((p) => `${p.left} → ${p.right}`).join(" · "); break;
    case "ORDERING": text = `Thứ tự đúng: ${q.content.correctOrder.map((id) => q.content.items.find((item) => item.id === id)?.text).join(" → ")}`; break;
    case "TRANSLATION": text = `${q.content.source} → ${q.content.acceptedAnswers.join(" / ")}`; break;
    case "WRITING": case "PRONUNCIATION": text = `${q.content.prompt} · Chấm thủ công, giữ DRAFT`; break;
    case "ARRANGE_SENTENCE": text = `Đáp án chuẩn: ${q.correctAnswer ?? ""}`; break;
    default: text = q.options.map((o) => `${o.isCorrect ? "✓ " : ""}${o.text}`).join(" · ");
  }
  return <div className="space-y-1 text-xs text-slate-300"><p className="break-words">{text}</p>{q.explanation && <p className="break-words">{q.explanation}</p>}{q.audioUrl && <audio className="w-full max-w-sm" controls preload="none" src={q.audioUrl} aria-label="Nghe thử câu hỏi" />}</div>;
}
export function DraftPreview({ draft, validation, onChange }: { draft: AiLessonDraft; validation: AiLessonValidationResult | null; onChange: (draft: AiLessonDraft) => void }) {
  const [editing, setEditing] = useState<{ kind: "block" | "word" | "question"; index: number; exerciseIndex?: number } | null>(null);
  const ids = new Map(draft.vocabulary.map((v) => [v.clientId, v.clientId]));
  const remove = (action: () => void) => { if (window.confirm("Xóa mục này khỏi bản nháp?")) action(); };
  function questionChange(ei: number, questions: AiLessonDraft["exercises"][number]["questions"]) { onChange({ ...draft, exercises: draft.exercises.map((e, i) => i === ei ? { ...e, questions: rank(questions) } : e) }); }
  return <div className="space-y-6" data-testid="ai-draft-preview">
    <section className={sectionClass}><h2 className="text-lg font-bold">1. Thông tin bài học</h2><div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tiêu đề bản nháp" value={draft.lesson.title} onChange={(title) => onChange({ ...draft, lesson: { ...draft.lesson, title } })} />
      <Field label="Slug bản nháp" value={draft.lesson.slug} onChange={(slug) => onChange({ ...draft, lesson: { ...draft.lesson, slug } })} />
      <Field label="Thời lượng bản nháp" type="number" min={0} max={180} value={draft.lesson.estimatedDuration} onChange={(v) => onChange({ ...draft, lesson: { ...draft.lesson, estimatedDuration: Number(v) } })} />
      <Field label="Trình độ bản nháp" value={draft.lesson.level} onChange={(level) => onChange({ ...draft, lesson: { ...draft.lesson, level } })} />
    </div><Field label="Tóm tắt bản nháp" multiline value={draft.lesson.summary} onChange={(summary) => onChange({ ...draft, lesson: { ...draft.lesson, summary } })} />
      <StringListEditor label="Nhãn bài học" path="lesson.tags" values={draft.lesson.tags} onChange={(tags) => onChange({ ...draft, lesson: { ...draft.lesson, tags } })} /><ValidationIssues result={validation} path="lesson" /></section>
    <section className={sectionClass}><h2 className="text-lg font-bold">2. Mục tiêu</h2><StringListEditor label="Mục tiêu" path="learningObjectives" values={draft.learningObjectives} onChange={(learningObjectives) => onChange({ ...draft, learningObjectives })} /><ValidationIssues result={validation} path="learningObjectives" /></section>
    <section className={sectionClass}><h2 className="text-lg font-bold">3. Content Blocks</h2>{draft.contentBlocks.map((b, i) => <article key={b.clientId} className="space-y-2 rounded-xl border border-slate-700 p-3">
      <p className="font-semibold">{i + 1}. {BLOCK_LABELS[b.type]}</p><p className="break-words text-sm text-slate-300">{contentBlockPreview(remapAiVocabularyReferences(b, ids))}</p>
      <LessonBlockRenderer block={{ ...remapAiVocabularyReferences(b, ids), id: b.clientId, lessonId: "draft", displayOrder: b.order, createdAt: new Date(0), updatedAt: new Date(0) }} vocabularies={aiVocabularyBank(draft)} />
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setEditing({ kind: "block", index: i })}>Sửa khối {i + 1}</button><ReorderButtons index={i} count={draft.contentBlocks.length} label="khối" onMove={(dir) => onChange({ ...draft, contentBlocks: rank(moveItem(draft.contentBlocks, i, dir)) })} /><button type="button" className={buttonClass} onClick={() => remove(() => onChange({ ...draft, contentBlocks: rank(draft.contentBlocks.filter((_, j) => j !== i)) }))}>Xóa khối {i + 1}</button></div><ValidationIssues result={validation} path={`contentBlocks.${i}`} /></article>)}</section>
    <section className={sectionClass}><h2 className="text-lg font-bold">4. Vocabulary</h2>{draft.vocabulary.map((v, i) => <article key={v.clientId} className="space-y-2 rounded-xl border border-slate-700 p-3">
      <p className="break-words">{v.hangul} · {v.romanization} · {v.vietnamese}</p><div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setEditing({ kind: "word", index: i })}>Sửa từ {i + 1}</button><ReorderButtons index={i} count={draft.vocabulary.length} label="từ" onMove={(dir) => onChange({ ...draft, vocabulary: moveItem(draft.vocabulary, i, dir) })} />
      <button type="button" className={buttonClass} onClick={() => {
        if (draft.contentBlocks.some((b) => b.type === "VOCABULARY" && b.content.vocabularyClientIds.includes(v.clientId))) { window.alert("Từ đang được khối tham chiếu. Hãy bỏ chọn trong khối trước khi xóa."); return; }
        remove(() => onChange({ ...draft, vocabulary: draft.vocabulary.filter((_, j) => j !== i) }));
      }}>Xóa từ {i + 1}</button></div><p className="break-words text-xs text-slate-400">{[v.english, v.partOfSpeech, v.difficulty ? `Độ khó ${v.difficulty}` : null, ...v.tags].filter(Boolean).join(" · ")}</p>
      {v.exampleSentenceHangul && <p className="break-words text-sm">{v.exampleSentenceHangul} · {v.exampleSentenceVi}</p>}{v.audioUrl && <audio className="w-full max-w-sm" controls preload="none" src={v.audioUrl} aria-label={`Nghe từ ${v.hangul}`} />}<ValidationIssues result={validation} path={`vocabulary.${i}`} /></article>)}</section>
    <section className={sectionClass}><h2 className="text-lg font-bold">5. Exercises</h2>{draft.exercises.map((e, ei) => <article key={e.clientId} className="space-y-3 rounded-xl border border-slate-700 p-3">
      <Field label={`Tên bài tập ${ei + 1}`} value={e.title} onChange={(title) => onChange({ ...draft, exercises: draft.exercises.map((item, i) => i === ei ? { ...item, title } : item) })} />
      <Field label={`Mô tả bài tập ${ei + 1}`} value={e.description} onChange={(description) => onChange({ ...draft, exercises: draft.exercises.map((item, i) => i === ei ? { ...item, description } : item) })} />
      <div className="flex flex-wrap gap-2"><ReorderButtons index={ei} count={draft.exercises.length} label="bài tập" onMove={(dir) => onChange({ ...draft, exercises: rank(moveItem(draft.exercises, ei, dir)) })} /><button type="button" className={buttonClass} onClick={() => remove(() => onChange({ ...draft, exercises: rank(draft.exercises.filter((_, i) => i !== ei)) }))}>Xóa bài tập {ei + 1}</button></div>
      {e.questions.map((q, qi) => <div key={q.clientId} className="space-y-2 rounded-xl bg-slate-950/70 p-3" data-testid={`ai-question-${ei}-${qi}`}><p className="text-xs text-indigo-300">Câu {qi + 1} · {QUESTION_LABELS[q.type]}</p><p className="break-words">{q.prompt}</p>
        <DraftQuestionAnswer question={q} />
        <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setEditing({ kind: "question", index: qi, exerciseIndex: ei })}>Sửa câu {qi + 1}</button><ReorderButtons index={qi} count={e.questions.length} label={`câu bài tập ${ei + 1}`} onMove={(dir) => questionChange(ei, moveItem(e.questions, qi, dir))} /><button type="button" className={buttonClass} onClick={() => remove(() => questionChange(ei, e.questions.filter((_, i) => i !== qi)))}>Xóa câu {qi + 1}</button></div><ValidationIssues result={validation} path={`exercises.${ei}.questions.${qi}`} /></div>)}
    </article>)}</section>
    {editing?.kind === "block" && <DraftBlockEditor block={draft.contentBlocks[editing.index]} draft={draft} onClose={() => setEditing(null)} onSave={(block) => { onChange({ ...draft, contentBlocks: draft.contentBlocks.map((b, i) => i === editing.index ? block : b) }); setEditing(null); }} />}
    {editing?.kind === "word" && <DraftVocabularyEditor word={draft.vocabulary[editing.index]} onClose={() => setEditing(null)} onSave={(word) => { onChange({ ...draft, vocabulary: draft.vocabulary.map((v, i) => i === editing.index ? word : v) }); setEditing(null); }} />}
    {editing?.kind === "question" && editing.exerciseIndex !== undefined && <DraftQuestionEditor question={draft.exercises[editing.exerciseIndex].questions[editing.index]} onClose={() => setEditing(null)} onSave={(q) => { const ei = editing.exerciseIndex; if (ei !== undefined) questionChange(ei, draft.exercises[ei].questions.map((item, i) => i === editing.index ? q : item)); setEditing(null); }} />}
  </div>;
}
