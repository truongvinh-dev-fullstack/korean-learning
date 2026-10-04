"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LessonFormSchema } from "@/modules/admin/admin.schema";
import { adminRequest, issueErrors, apiFieldErrors, AdminApiError, type FieldErrors } from "@/modules/admin/admin.client";
import { StringListEditor, Feedback, primaryClass, sectionClass } from "./form-controls";

export function LessonObjectives({ lessonId, initialObjectives }: { lessonId: string; initialObjectives: string[] }) {
  const router = useRouter();
  const [values, setValues] = useState(initialObjectives);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const running = useRef(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    setErrors({}); setError(null); setMessage(null);
    const parsed = LessonFormSchema.partial().safeParse({ learningObjectives: values });
    if (!parsed.success) { setErrors(issueErrors(parsed.error.issues)); return; }
    running.current = true; setBusy(true);
    try { await adminRequest(`/api/admin/lessons/${lessonId}`, "PUT", parsed.data); setMessage("Đã lưu mục tiêu bài học."); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu mục tiêu."); if (cause instanceof AdminApiError) setErrors(apiFieldErrors(cause.details)); }
    finally { running.current = false; setBusy(false); }
  }
  return <form onSubmit={save} className={sectionClass} noValidate><h2 className="font-bold text-white">2. Mục tiêu bài học</h2>
    <fieldset disabled={busy} className="space-y-4"><StringListEditor label="Mục tiêu" values={values} onChange={setValues} path="learningObjectives" errors={errors} />
      <Feedback error={error} message={message} /><button type="submit" className={primaryClass}>{busy ? "Đang lưu…" : "Lưu mục tiêu"}</button></fieldset>
  </form>;
}
