"use client";

import { useState } from "react";
import type { ContentStatus } from "@prisma/client";
import { ExerciseFormSchema } from "@/modules/admin/admin.schema";
import { issueErrors } from "@/modules/admin/admin.client";
import type { QuestionDto } from "@/modules/admin/lesson-detail.mapper";
import { useAdminCollection } from "./use-admin-collection";
import { ExerciseCard, type ExerciseItem } from "./exercise-card";
import { QuestionEditor } from "./question-editor";
import { EditorModal, Feedback, Field, SelectField, primaryClass, buttonClass, sectionClass } from "./form-controls";
import { DeleteConfirmDialog } from "../delete-confirm-dialog";

export type { ExerciseItem } from "./exercise-card";
export type QuestionItem = QuestionDto;
export type QuestionOptionItem = QuestionDto["options"][number];

export function LessonExerciseEditor({ lessonId, initialExercises }: { lessonId: string; initialExercises: ExerciseItem[] }) {
  const collection = useAdminCollection(initialExercises, `/api/admin/lessons/${lessonId}/exercises`);
  const [exerciseEditor, setExerciseEditor] = useState<{ id?: string; title: string; description: string; status: ContentStatus } | null>(null);
  const [questionEditor, setQuestionEditor] = useState<{ exerciseId: string; question?: QuestionDto } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "exercises" | "questions"; id: string; title: string } | null>(null);
  const reset = collection.resetFeedback;
  async function saveExercise(event: React.FormEvent) {
    event.preventDefault(); if (!exerciseEditor) return;
    const parsed = ExerciseFormSchema.safeParse({ ...exerciseEditor, lessonId });
    if (!parsed.success) { collection.setErrors(issueErrors(parsed.error.issues)); return; }
    if (await collection.mutate(exerciseEditor.id ? `/api/admin/exercises/${exerciseEditor.id}` : `/api/admin/lessons/${lessonId}/exercises`, exerciseEditor.id ? "PUT" : "POST", parsed.data)) setExerciseEditor(null);
  }
  return <section className={sectionClass}><div className="flex flex-wrap justify-between gap-3">
    <h2 className="font-bold text-white">5. Bài tập & câu hỏi chấm điểm ({collection.items.length})</h2>
    <button type="button" className={primaryClass} disabled={collection.busy} onClick={() => { reset(); setExerciseEditor({ title: "", description: "", status: "DRAFT" }); }}>+ Thêm bài tập</button>
  </div><Feedback error={collection.error} message={collection.message} />
    {collection.error && !questionEditor && !exerciseEditor && <button type="button" className={buttonClass} disabled={collection.busy} onClick={collection.reload}>Tải lại</button>}
    {collection.busy && <p role="status" className="text-xs text-slate-400">Đang cập nhật bài tập…</p>}
    {!collection.items.length && <p className="p-5 text-center text-sm text-slate-400">Chưa có bài tập trong bài học.</p>}
    {collection.items.map((exercise, index) => <ExerciseCard key={exercise.id} exercise={exercise} index={index} count={collection.items.length} busy={collection.busy}
      onEdit={() => { reset(); setExerciseEditor({ ...exercise, description: exercise.description ?? "" }); }}
      onDelete={() => { reset(); setDeleteTarget({ type: "exercises", id: exercise.id, title: exercise.title }); }}
      onMove={(direction) => { void collection.mutate(`/api/admin/exercises/${exercise.id}/reorder`, "POST", { direction }); }}
      onQuestion={(question) => { reset(); setQuestionEditor({ exerciseId: exercise.id, question }); }}
      onDeleteQuestion={(question) => { reset(); setDeleteTarget({ type: "questions", id: question.id, title: question.prompt }); }}
      onMoveQuestion={(question, direction) => { void collection.mutate(`/api/admin/questions/${question.id}/reorder`, "POST", { direction }); }} />)}
    {exerciseEditor && <EditorModal title={exerciseEditor.id ? "Sửa bài tập" : "Thêm bài tập"} busy={collection.busy} onClose={() => setExerciseEditor(null)}>
      <form onSubmit={saveExercise} noValidate><fieldset disabled={collection.busy} className="space-y-4">
        <Field label="Tiêu đề bài tập" value={exerciseEditor.title} path="title" errors={collection.errors} onChange={(title) => setExerciseEditor({ ...exerciseEditor, title })} />
        <Field label="Mô tả bài tập" value={exerciseEditor.description} path="description" errors={collection.errors} multiline onChange={(description) => setExerciseEditor({ ...exerciseEditor, description })} />
        <SelectField label="Trạng thái bài tập" value={exerciseEditor.status} onChange={(status) => setExerciseEditor({ ...exerciseEditor, status: status as ContentStatus })}>
          <option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã xuất bản</option><option value="ARCHIVED">Lưu trữ</option></SelectField>
        <Feedback error={collection.error} /><button type="submit" className={primaryClass}>{collection.busy ? "Đang lưu…" : "Lưu bài tập"}</button>
      </fieldset></form></EditorModal>}
    {questionEditor && <QuestionEditor {...questionEditor} busy={collection.busy} error={collection.error} errors={collection.errors} onErrors={collection.setErrors} onClose={() => setQuestionEditor(null)}
      onSave={async (payload) => { const id = questionEditor.question?.id;
        if (await collection.mutate(id ? `/api/admin/questions/${id}` : `/api/admin/exercises/${questionEditor.exerciseId}/questions`, id ? "PUT" : "POST", payload)) setQuestionEditor(null);
      }} />}
    {deleteTarget && <DeleteConfirmDialog isOpen title="Xác nhận xóa?" itemName={deleteTarget.title} description="Hệ thống giữ dữ liệu có lịch sử làm bài của học viên."
      errorMessage={collection.error} isDeleting={collection.busy} onCancel={() => setDeleteTarget(null)} onConfirm={async () => {
        if (await collection.mutate(`/api/admin/${deleteTarget.type}/${deleteTarget.id}`, "DELETE")) setDeleteTarget(null);
      }} />}
  </section>;
}
