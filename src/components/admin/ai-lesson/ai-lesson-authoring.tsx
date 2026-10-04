"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, AdminApiError } from "@/modules/admin/admin.client";
import type { AiLessonDraft, AiLessonGenerateInput, AiLessonPreview, AiLessonTarget } from "@/modules/ai-lessons/ai-lesson.schema";
import { Field, SelectField, Feedback, sectionClass, primaryClass, buttonClass } from "@/components/admin/lesson-detail/form-controls";
import { DraftPreview, ValidationIssues } from "./draft-preview";
import { aiGenerationErrorMessage } from "@/modules/ai-lessons/ai-generation.errors";
import type { AiGenerationMetadata } from "@/modules/ai-lessons/ai-generation.types";

export function AiLessonAuthoring({ chapterId, lessonId, lessonStatus, mock }: { chapterId: string; lessonId?: string; lessonStatus?: string; mock: boolean }) {
  const router = useRouter(); const running = useRef(false); const key = useRef<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "validate" | "import" | null>(null); const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<AiLessonGenerateInput>({ topic: "", level: "BEGINNER_1", lessonNumber: null, duration: 20, targetAudience: "Người Việt mới bắt đầu học tiếng Hàn", notes: null });
  const [target, setTarget] = useState<AiLessonTarget>(lessonId ? { mode: "APPEND", lessonId } : { mode: "NEW", chapterId });
  const [draft, setDraft] = useState<AiLessonDraft | null>(null); const [preview, setPreview] = useState<AiLessonPreview | null>(null);
  const [stale, setStale] = useState(false); const [uncertain, setUncertain] = useState(false);
  const [generation, setGeneration] = useState<AiGenerationMetadata | undefined>();
  const generationToken = useRef<string | undefined>(undefined);
  function changeDraft(next: AiLessonDraft) { if (uncertain) return; setDraft(next); setStale(true); setPreview(null); key.current = null; }
  async function run(action: "generate" | "validate" | "import") {
    if (running.current) return;
    if (action === "generate" && draft && !window.confirm("Tạo bản nháp mới sẽ bỏ các sửa đổi chưa nhập. Tiếp tục?")) return;
    if (action === "import") {
      if (!draft || !preview?.validation.valid || !preview.validationToken || stale) return;
      if (!window.confirm(`Nhập toàn bộ bản nháp vào bài học ở trạng thái DRAFT?${preview.validation.warnings.length ? ` Có ${preview.validation.warnings.length} cảnh báo cần bạn đối chiếu.` : ""}`)) return;
      if (target.mode === "REPLACE" && !window.confirm("THAY TOÀN BỘ metadata, mục tiêu, khối, từ vựng và bài tập cũ của bản DRAFT. Xác nhận thay thế?")) return;
    }
    running.current = true; setBusy(action); setError(null);
    try {
      if (action === "import" && draft && preview?.validationToken) {
        key.current ??= crypto.randomUUID();
        const result = await adminRequest<{ lessonId: string }>("/api/admin/ai-lessons/import", "POST", { draft, target, validationToken: preview.validationToken, generationToken: generationToken.current, idempotencyKey: key.current, confirmed: true, replaceConfirmed: target.mode === "REPLACE" });
        setUncertain(false); router.push(`/admin/lessons/${result.lessonId}/edit`); router.refresh();
      } else {
        const result = await adminRequest<AiLessonPreview>(`/api/admin/ai-lessons/${action}`, "POST", action === "generate" ? { input, target, requestId: crypto.randomUUID() } : { draft, target, generationToken: generationToken.current });
        if (action === "generate") { setGeneration(result.generation); generationToken.current = result.generationToken; }
        if (result.errorCode) setError(aiGenerationErrorMessage(result.errorCode) ?? null);
        setPreview(result); if (result.draft) setDraft(result.draft); else if (action === "generate") setDraft(null);
        setStale(false); key.current = null;
      }
    } catch (cause) {
      setError(cause instanceof AdminApiError ? aiGenerationErrorMessage(cause.code) ?? cause.message : cause instanceof Error ? cause.message : "Không thực hiện được thao tác.");
      // Preserve draft/key after any import failure; a lost response may follow a successful commit.
      if (action === "import") setUncertain(!(cause instanceof AdminApiError) || cause.httpStatus === undefined || cause.httpStatus >= 500);
    } finally { running.current = false; setBusy(null); }
  }
  const blocked = target.mode !== "NEW" && lessonStatus !== "DRAFT";
  return <div className="space-y-6 text-white">
    {mock && <p className="rounded-xl bg-amber-950/50 p-3 text-sm text-amber-200">Chế độ dev/test: provider mẫu nguyên âm cố định. Không gọi dịch vụ AI thật.</p>}
    <form onSubmit={(event) => { event.preventDefault(); void run("generate"); }} className={sectionClass}><fieldset disabled={!!busy || uncertain} className="space-y-4">
      <Field label="Chủ đề" value={input.topic} multiline onChange={(topic) => setInput({ ...input, topic })} />
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Trình độ" value={input.level} onChange={(level) => setInput({ ...input, level })} />
        <Field label="Số bài" type="number" min={1} value={input.lessonNumber} onChange={(v) => setInput({ ...input, lessonNumber: v ? Number(v) : null })} />
        <Field label="Thời lượng (phút)" type="number" min={1} max={180} value={input.duration} onChange={(v) => setInput({ ...input, duration: v ? Number(v) : null })} />
        <Field label="Đối tượng" value={input.targetAudience} onChange={(targetAudience) => setInput({ ...input, targetAudience: targetAudience || null })} /></div>
      <Field label="Ghi chú" multiline value={input.notes} onChange={(notes) => setInput({ ...input, notes: notes || null })} />
      <SelectField label="Cách nhập bản nháp" value={target.mode} onChange={(mode) => { setTarget(mode === "NEW" ? { mode, chapterId } : { mode: mode === "REPLACE" ? "REPLACE" : "APPEND", lessonId: lessonId ?? "" }); setStale(true); setPreview(null); key.current = null; }}>
        <option value="NEW">Tạo bài học mới (DRAFT)</option>{lessonId && <><option value="APPEND">Append vào bài hiện tại</option><option value="REPLACE">Replace toàn bộ nội dung DRAFT</option></>}
      </SelectField>
      {target.mode === "APPEND" && <p className="text-xs text-slate-300">Giữ thông tin và nội dung hiện tại; nối mục tiêu, khối, từ vựng và bài tập mới.</p>}
      {target.mode === "REPLACE" && <p className="text-xs text-amber-300">Thay toàn bộ thông tin và nội dung nháp sau hai bước xác nhận. Bài có lịch sử học viên sẽ bị chặn.</p>}
      <button type="submit" disabled={!!busy || uncertain || !input.topic.trim()} className={primaryClass}>{busy === "generate" ? "Đang tạo nội dung bài học..." : "Tạo bản nháp"}</button>
    </fieldset></form><Feedback error={error} />
    {preview && <section className={sectionClass} aria-label="Trạng thái kiểm tra"><p>Schema: {preview.validation.schemaValid ? "✓ Hợp lệ" : "✕ Không hợp lệ"}</p><p>Knowledge: {preview.validation.errors.length} lỗi · {preview.validation.warnings.length} cảnh báo</p><ValidationIssues result={preview.validation} /></section>}
    {draft && <><p className="text-sm text-slate-300">AI tạo bản nháp{generation ? ` · ${generation.model} · ${new Date(generation.generatedAt).toLocaleString("vi-VN")}` : ""}. Nội dung chưa được ghi vào database.</p><fieldset disabled={!!busy || uncertain} className="min-w-0"><DraftPreview draft={draft} validation={preview?.validation ?? null} onChange={changeDraft} /></fieldset>
      <div className="sticky bottom-3 space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
        {stale && <p role="status" className="text-sm text-amber-300">Bản nháp đã thay đổi. Hãy kiểm tra lại trước khi nhập.</p>}
        {blocked && <p className="text-sm text-rose-300">Bài hiện tại chưa ở DRAFT. Chuyển về DRAFT trong Lesson Detail hoặc chọn tạo bài mới.</p>}
        {uncertain && <p className="text-xs text-amber-300">Giữ nguyên bản nháp để thử lại cùng mã nhập. Nếu cần sửa, hãy mở Lesson Detail kiểm tra kết quả trước, rồi mở lại luồng AI.</p>}
        <div className="flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={!!busy || uncertain} onClick={() => void run("validate")}>{busy === "validate" ? "Đang kiểm tra..." : "Kiểm tra lại"}</button>
          <button type="button" className={primaryClass} disabled={!!busy || blocked || stale || !preview?.validation.valid || !preview.validationToken} onClick={() => void run("import")}>{busy === "import" ? "Đang nhập..." : uncertain ? "Thử lại nhập cùng yêu cầu" : "Nhập vào bài học"}</button></div>
      </div></>}
  </div>;
}
