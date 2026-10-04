import type { ContentStatus } from "@prisma/client";
import type { QuestionDto } from "@/modules/admin/lesson-detail.mapper";
import { QUESTION_LABELS } from "@/modules/admin/lesson-detail.constants";
import { isManualQuestion } from "@/modules/exercises/question.schema";
import { ReorderButtons, buttonClass, primaryClass } from "./form-controls";

export interface ExerciseItem { id: string; lessonId: string; title: string; description: string | null; status: ContentStatus; displayOrder: number; questions: QuestionDto[]; _count?: { attempts: number } }
export function ExerciseCard({ exercise, index, count, busy, onEdit, onDelete, onMove, onQuestion, onDeleteQuestion, onMoveQuestion }: {
  exercise: ExerciseItem; index: number; count: number; busy: boolean; onEdit: () => void; onDelete: () => void; onMove: (direction: "UP" | "DOWN") => void;
  onQuestion: (question?: QuestionDto) => void; onDeleteQuestion: (question: QuestionDto) => void; onMoveQuestion: (question: QuestionDto, direction: "UP" | "DOWN") => void;
}) {
  return <article className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-white">{exercise.title}</h3>
      <p className="text-xs text-slate-400">{{ DRAFT: "Bản nháp", PUBLISHED: "Đã xuất bản", ARCHIVED: "Lưu trữ" }[exercise.status]} · {exercise.questions.length} câu hỏi</p><p className="text-sm text-slate-400">{exercise.description}</p></div>
      <div className="flex flex-wrap gap-2"><ReorderButtons index={index} count={count} label="bài tập" disabled={busy} onMove={onMove} />
        <button type="button" className={buttonClass} disabled={busy} onClick={onEdit}>Sửa bài tập</button><button type="button" className={`${buttonClass} text-rose-300`} disabled={busy} onClick={onDelete}>Xóa bài tập</button></div></div>
    <div className="space-y-2">{exercise.questions.map((question, i) => <div key={question.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-slate-800 p-3">
      <div className="min-w-0 flex-1"><p className="text-xs text-indigo-300">{QUESTION_LABELS[question.type]}</p>
        {isManualQuestion(question.type) && <p className="text-xs text-amber-300">Chấm thủ công · Chưa hỗ trợ tự động chấm</p>}<p className="text-sm text-white">{i + 1}. {question.prompt}</p>
        {!!question.options.length && <p className="text-xs text-slate-400">{question.options.length} lựa chọn</p>}</div>
      <div className="flex gap-2"><ReorderButtons index={i} count={exercise.questions.length} label="câu hỏi" disabled={busy} onMove={(direction) => onMoveQuestion(question, direction)} />
        <button type="button" className={buttonClass} disabled={busy} onClick={() => onQuestion(question)}>Sửa câu hỏi</button>
        <button type="button" className={`${buttonClass} text-rose-300`} disabled={busy} onClick={() => onDeleteQuestion(question)}>Xóa câu hỏi</button></div>
    </div>)}</div>
    {!exercise.questions.length && <p className="text-sm text-slate-400">Chưa có câu hỏi.</p>}
    <button type="button" className={primaryClass} disabled={busy} onClick={() => onQuestion()}>+ Thêm câu hỏi</button>
  </article>;
}
