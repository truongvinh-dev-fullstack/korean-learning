"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { createQuestionForm, mapQuestionDtoToForm, mapQuestionFormToPayload, type QuestionDto } from "@/modules/admin/lesson-detail.mapper";
import type { SupportedQuestionType } from "@/modules/exercises/question.schema";
import { QUESTION_LABELS } from "@/modules/admin/lesson-detail.constants";
import { issueErrors, type FieldErrors } from "@/modules/admin/admin.client";
import { Field, EditorModal, SelectField, Feedback, primaryClass } from "./form-controls";
import { QuestionFields } from "./question-fields";

export function QuestionEditor({ exerciseId, question, busy, error, errors, onErrors, onClose, onSave }: {
  exerciseId: string; question?: QuestionDto; busy: boolean; error: string | null; errors: FieldErrors; onErrors: (errors: FieldErrors) => void;
  onClose: () => void; onSave: (payload: ReturnType<typeof mapQuestionFormToPayload>) => Promise<void>;
}) {
  const [form, setForm] = useState(() => {
    try { return question ? mapQuestionDtoToForm(question) : createQuestionForm(); } catch { return null; }
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const running = useRef(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || busy || running.current) return;
    running.current = true; setLocalError(null);
    try { const payload = mapQuestionFormToPayload(exerciseId, form); onErrors({}); await onSave(payload); }
    catch (cause) { if (cause instanceof z.ZodError) onErrors(issueErrors(cause.issues)); else setLocalError("Không thể lưu câu hỏi. Tải lại để kiểm tra dữ liệu trước khi thử lại."); }
    finally { running.current = false; }
  }
  if (!form) return <EditorModal title="Không thể mở câu hỏi" onClose={onClose}><Feedback error="Dữ liệu câu hỏi cũ không hợp lệ. Hệ thống giữ nguyên dữ liệu; cần kiểm tra bản gốc trước khi sửa." /></EditorModal>;
  return <EditorModal title={question ? "Sửa câu hỏi" : "Thêm câu hỏi"} busy={busy} onClose={onClose}>
    <form noValidate onSubmit={save}><fieldset disabled={busy} className="space-y-4">
      <SelectField label="Loại câu hỏi" value={form.type} onChange={(type) => {
        if (window.confirm("Đổi loại câu hỏi sẽ tạo lại phần đáp án. Tiếp tục?")) {
          onErrors({}); setForm({ ...createQuestionForm(type as SupportedQuestionType), prompt: form.prompt, explanation: form.explanation });
        }
      }}>{Object.entries(QUESTION_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</SelectField>
      <Field label="Đề bài câu hỏi" value={form.prompt} path="prompt" errors={errors} multiline onChange={(prompt) => setForm({ ...form, prompt })} />
      <QuestionFields form={form} onChange={setForm} errors={errors} />
      <Field label="Giải thích đáp án" value={form.explanation} path="explanation" errors={errors} multiline onChange={(explanation) => setForm({ ...form, explanation })} />
      <Feedback error={localError || error} /><button type="submit" className={primaryClass}>{busy ? "Đang lưu…" : "Lưu câu hỏi"}</button>
    </fieldset></form></EditorModal>;
}
