"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { adminRequest, AdminApiError, apiFieldErrors, issueErrors, type FieldErrors } from "@/modules/admin/admin.client";
import { mapLessonDtoToForm, mapLessonFormToPayload, type LessonInfoDto } from "@/modules/admin/lesson-detail.mapper";
import { Field, SelectField, StringListEditor, Feedback, primaryClass, sectionClass } from "./lesson-detail/form-controls";

export type LessonMetaData = LessonInfoDto;
export function LessonMetaEditor({ lesson }: { lesson: LessonMetaData }) {
  const router = useRouter();
  const [form, setForm] = useState(() => mapLessonDtoToForm(lesson));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    setErrors({}); setError(null); setMessage(null);
    let payload;
    try { payload = mapLessonFormToPayload(form); }
    catch (cause) { if (cause instanceof z.ZodError) setErrors(issueErrors(cause.issues)); return; }
    running.current = true; setBusy(true);
    try { await adminRequest(`/api/admin/lessons/${lesson.id}`, "PUT", payload); setMessage("Đã lưu thông tin bài học."); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu bài học."); if (cause instanceof AdminApiError) setErrors(apiFieldErrors(cause.details)); }
    finally { running.current = false; setBusy(false); }
  }
  return <form onSubmit={save} className={sectionClass} noValidate><h2 className="font-bold text-white">1. Thông tin chung bài học</h2>
    <fieldset disabled={busy} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tiêu đề bài học" value={form.title} errors={errors} path="title" onChange={(title) => setForm({ ...form, title })} />
        <Field label="Đường dẫn (Slug)" value={form.slug} errors={errors} path="slug" onChange={(slug) => setForm({ ...form, slug })} />
        <Field label="Thời lượng ước tính (phút)" type="number" min={0} max={180} value={form.estimatedMinutes} errors={errors} path="estimatedMinutes" onChange={(value) => setForm({ ...form, estimatedMinutes: Number(value) })} />
        <Field label="Cấp độ bài học" value={form.level} errors={errors} path="level" onChange={(level) => setForm({ ...form, level })} />
      </div>
      <Field label="Tóm tắt bài học" multiline value={form.summary} errors={errors} path="summary" onChange={(summary) => setForm({ ...form, summary })} />
      <StringListEditor label="Nhãn" values={form.tags} onChange={(tags) => setForm({ ...form, tags })} errors={errors} path="tags" />
      <SelectField label="Trạng thái xuất bản" value={form.status} onChange={(status) => setForm({ ...form, status: status as LessonMetaData["status"] })}>
        <option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã xuất bản</option><option value="ARCHIVED">Lưu trữ</option>
      </SelectField>
      <Feedback error={error} message={message} /><button type="submit" className={primaryClass}>{busy ? "Đang lưu…" : "Lưu thông tin bài học"}</button>
    </fieldset></form>;
}
