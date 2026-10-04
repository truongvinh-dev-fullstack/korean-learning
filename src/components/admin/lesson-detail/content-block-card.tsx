import { BLOCK_LABELS } from "@/modules/admin/lesson-detail.constants";
import { contentBlockPreview, mapContentBlockDtoToForm } from "@/modules/lessons/lesson-content";
import { buttonClass, ReorderButtons } from "./form-controls";
import type { LessonBlockItem } from "./lesson-content-blocks";

export function ContentBlockCard({ block, index, count, busy, onEdit, onDelete, onDuplicate, onMove }: {
  block: LessonBlockItem; index: number; count: number; busy: boolean;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void; onMove: (direction: "UP" | "DOWN") => void;
}) {
  let title = `Khối ${index + 1}`, preview = "Nội dung cũ cần kiểm tra schema.";
  try { const parsed = mapContentBlockDtoToForm(block); title = parsed.content.title || title; preview = contentBlockPreview(parsed); } catch { /* Keep the record visible for recovery. */ }
  return <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
    <div className="min-w-0 flex-1 space-y-2"><span className="rounded bg-indigo-950 px-2 py-1 text-xs text-indigo-300">{BLOCK_LABELS[block.type]}</span>
      <h4 className="font-semibold text-white">{title}</h4><p className="line-clamp-2 whitespace-pre-line text-sm text-slate-400">{preview}</p></div>
    <div className="flex flex-wrap gap-2"><ReorderButtons index={index} count={count} disabled={busy} onMove={onMove} label="khối" />
      <button type="button" disabled={busy} className={buttonClass} onClick={onEdit}>Sửa</button>
      <button type="button" disabled={busy} className={buttonClass} onClick={onDuplicate}>Nhân bản</button>
      <button type="button" disabled={busy} className={`${buttonClass} text-rose-300`} onClick={onDelete}>Xóa</button></div>
  </article>;
}
