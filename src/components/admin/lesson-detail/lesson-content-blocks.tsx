"use client";

import { useState } from "react";
import { z } from "zod";
import type { BlockType } from "@prisma/client";
import { BLOCK_LABELS } from "@/modules/admin/lesson-detail.constants";
import { issueErrors } from "@/modules/admin/admin.client";
import { createContentBlockForm, mapContentBlockDtoToForm, mapContentBlockFormToPayload, updateContentBlockTitle, type VocabularyBankEntry } from "@/modules/lessons/lesson-content";
import type { DiscriminatedLessonBlock } from "@/modules/lessons/lesson-block.schema";
import { DeleteConfirmDialog } from "../delete-confirm-dialog";
import { ContentBlockFields } from "./content-block-fields";
import { ContentBlockCard } from "./content-block-card";
import { EditorModal, Field, Feedback, SelectField, buttonClass, primaryClass, sectionClass } from "./form-controls";
import { useAdminCollection } from "./use-admin-collection";

export interface LessonBlockItem { id: string; lessonId: string; type: BlockType; displayOrder: number; content: unknown }

export function LessonBlocksEditor({ lessonId, initialBlocks, vocabulary = [] }: { lessonId: string; initialBlocks: LessonBlockItem[]; vocabulary?: VocabularyBankEntry[] }) {
  const collection = useAdminCollection(initialBlocks, `/api/admin/lessons/${lessonId}/blocks`);
  const [editor, setEditor] = useState<{ id?: string; form: DiscriminatedLessonBlock } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LessonBlockItem | null>(null);
  const reset = collection.resetFeedback;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editor) return;
    let payload;
    try { payload = mapContentBlockFormToPayload(editor.form); }
    catch (cause) {
      if (cause instanceof z.ZodError) collection.setErrors(issueErrors(cause.issues));
      collection.setError("Kiểm tra các trường được đánh dấu."); return;
    }
    if (await collection.mutate(editor.id ? `/api/admin/blocks/${editor.id}` : `/api/admin/lessons/${lessonId}/blocks`, editor.id ? "PUT" : "POST", payload)) setEditor(null);
  }
  function edit(block: LessonBlockItem) {
    reset();
    try { setEditor({ id: block.id, form: mapContentBlockDtoToForm(block) }); }
    catch { collection.setError("Nội dung cũ không đúng schema. Kiểm tra dữ liệu gốc; hệ thống đã giữ nguyên khối."); }
  }
  return <section className={sectionClass}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-white">3. Khối nội dung bài giảng ({collection.items.length})</h2>
      <button type="button" className={primaryClass} disabled={collection.busy} onClick={() => { reset(); setEditor({ form: createContentBlockForm("TEXT") }); }}>+ Thêm khối nội dung</button></div>
    <Feedback error={collection.error} message={collection.message} />
    {collection.error && !editor && <button type="button" className={buttonClass} disabled={collection.busy} onClick={collection.reload}>Tải lại</button>}
    {collection.busy && <p role="status" className="text-xs text-slate-400">Đang cập nhật nội dung…</p>}
    <div className="space-y-3">{collection.items.map((block, index) => <ContentBlockCard key={block.id} block={block} index={index} count={collection.items.length} busy={collection.busy}
      onEdit={() => edit(block)} onDelete={() => { reset(); setDeleteTarget(block); }}
      onMove={(direction) => { void collection.mutate(`/api/admin/blocks/${block.id}/reorder`, "POST", { direction }); }}
      onDuplicate={() => { void collection.mutate(`/api/admin/lessons/${lessonId}/blocks`, "POST", { type: block.type, content: block.content }); }} />)}</div>
    {collection.items.length === 0 && <p className="p-5 text-center text-sm text-slate-400">Chưa có khối nội dung. Thêm khối để bắt đầu soạn bài.</p>}
    {editor && <EditorModal title={editor.id ? "Sửa khối nội dung" : "Thêm khối nội dung"} busy={collection.busy} onClose={() => setEditor(null)}>
      <form onSubmit={save} className="space-y-4" noValidate><fieldset disabled={collection.busy} className="space-y-4">
        <SelectField label="Loại khối nội dung" value={editor.form.type} onChange={(type) => {
          if (window.confirm("Đổi loại khối sẽ tạo form trống. Tiếp tục?")) { reset(); setEditor({ ...editor, form: createContentBlockForm(type as BlockType) }); }
        }}>{Object.entries(BLOCK_LABELS).map(([type, label]) => <option value={type} key={type}>{label}</option>)}</SelectField>
        <Field label="Tiêu đề khối" value={editor.form.content.title} path="content.title" errors={collection.errors}
          onChange={(title) => setEditor({ ...editor, form: updateContentBlockTitle(editor.form, title) })} />
        <ContentBlockFields form={editor.form} vocabulary={vocabulary} errors={collection.errors} onChange={(form) => setEditor({ ...editor, form })} />
        <Feedback error={collection.error} /><button type="submit" className={primaryClass}>{collection.busy ? "Đang lưu…" : "Lưu khối nội dung"}</button>
      </fieldset></form></EditorModal>}
    {deleteTarget && <DeleteConfirmDialog isOpen title="Xóa khối nội dung?" description="Các khối khác và ngân hàng từ vựng được giữ nguyên."
      itemName={BLOCK_LABELS[deleteTarget.type]} isDeleting={collection.busy} errorMessage={collection.error} onCancel={() => setDeleteTarget(null)}
      onConfirm={async () => { if (await collection.mutate(`/api/admin/blocks/${deleteTarget.id}`, "DELETE")) setDeleteTarget(null); }} />}
  </section>;
}
