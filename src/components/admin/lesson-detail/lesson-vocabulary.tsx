"use client";

import { useState } from "react";
import { z } from "zod";
import { mapVocabularyDtoToForm, mapVocabularyFormToPayload, type VocabularyDto } from "@/modules/admin/lesson-detail.mapper";
import { issueErrors } from "@/modules/admin/admin.client";
import { VocabularyAudioButton } from "@/components/lessons/vocabulary-audio-button";
import { getVocabularyAudioUrl } from "@/shared/audio/vocabulary-audio";
import { DeleteConfirmDialog } from "../delete-confirm-dialog";
import { VocabularyEditor } from "./vocabulary-editor";
import { useAdminCollection } from "./use-admin-collection";
import { EditorModal, Feedback, ReorderButtons, primaryClass, buttonClass, sectionClass } from "./form-controls";

export type VocabularyItem = VocabularyDto;
export function LessonVocabEditor({ lessonId, initialVocabularies }: { lessonId: string; initialVocabularies: VocabularyItem[] }) {
  // Refresh the lesson snapshot so reference pickers also see the updated bank.
  const collection = useAdminCollection(initialVocabularies, `/api/admin/lessons/${lessonId}/vocabularies`, true);
  const [editor, setEditor] = useState<{ id?: string; form: ReturnType<typeof mapVocabularyDtoToForm> } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VocabularyItem | null>(null);
  const reset = collection.resetFeedback;
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editor) return;
    let payload;
    try { payload = mapVocabularyFormToPayload(lessonId, editor.form); }
    catch (cause) { if (cause instanceof z.ZodError) collection.setErrors(issueErrors(cause.issues)); return; }
    if (await collection.mutate(editor.id ? `/api/admin/vocabularies/${editor.id}` : `/api/admin/lessons/${lessonId}/vocabularies`, editor.id ? "PUT" : "POST", payload)) setEditor(null);
  }
  return <section className={sectionClass}><div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="font-bold text-white">4. Ngân hàng từ vựng ({collection.items.length})</h2>
    <button type="button" className={primaryClass} disabled={collection.busy} onClick={() => { reset(); setEditor({ form: mapVocabularyDtoToForm() }); }}>+ Thêm từ vựng</button>
  </div><p className="text-xs text-slate-400">Chọn từ trong ngân hàng để đưa vào khối từ vựng và thẻ ôn tập.</p>
    <Feedback error={collection.error} message={collection.message} />
    {collection.error && !editor && <button type="button" className={buttonClass} disabled={collection.busy} onClick={collection.reload}>Tải lại</button>}
    {collection.busy && <p role="status" className="text-xs text-slate-400">Đang cập nhật từ vựng…</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-sm text-slate-300"><thead><tr className="border-b border-slate-700"><th className="p-2">Thứ tự</th><th className="p-2">Từ vựng</th><th className="p-2">Nghĩa</th><th className="p-2">Thao tác</th></tr></thead>
      <tbody>{collection.items.map((word, index) => <tr key={word.id} className="border-b border-slate-800">
        <td className="p-2"><ReorderButtons index={index} count={collection.items.length} label="từ" disabled={collection.busy} onMove={(direction) => { void collection.mutate(`/api/admin/vocabularies/${word.id}/reorder`, "POST", { direction }); }} /></td>
        <td className="p-2"><div className="flex items-center gap-2"><strong className="whitespace-nowrap text-white">{word.hangul}</strong><VocabularyAudioButton hangul={word.hangul} audioUrl={getVocabularyAudioUrl(word.hangul, word.audioUrl)} /></div><p className="text-xs text-indigo-300">{word.romanization}</p></td>
        <td className="p-2"><p>{word.vietnameseMeaning}</p><p className="text-xs text-slate-500">{word.partOfSpeech} {word.difficulty ? `· Độ khó ${word.difficulty}` : ""}</p></td>
        <td className="p-2"><div className="flex gap-2"><button type="button" className={buttonClass} disabled={collection.busy} onClick={() => { reset(); setEditor({ id: word.id, form: mapVocabularyDtoToForm(word) }); }}>Sửa</button>
          <button type="button" className={`${buttonClass} text-rose-300`} disabled={collection.busy} onClick={() => { reset(); setDeleteTarget(word); }}>Xóa</button></div></td>
      </tr>)}{!collection.items.length && <tr><td colSpan={4} className="p-6 text-center text-slate-400">Chưa có từ vựng trong ngân hàng.</td></tr>}</tbody></table></div>
    {editor && <EditorModal title={editor.id ? "Sửa từ vựng" : "Thêm từ vựng"} busy={collection.busy} onClose={() => setEditor(null)}>
      <form noValidate onSubmit={save}><fieldset disabled={collection.busy} className="space-y-4"><VocabularyEditor form={editor.form} onChange={(form) => setEditor({ ...editor, form })} errors={collection.errors} />
        <Feedback error={collection.error} /><button className={primaryClass} type="submit">{collection.busy ? "Đang lưu…" : "Lưu từ vựng"}</button></fieldset></form>
    </EditorModal>}
    {deleteTarget && <DeleteConfirmDialog isOpen title="Xóa từ vựng?" itemName={deleteTarget.hangul} description="Hệ thống từ chối xóa từ đang dùng trong khối nội dung hoặc SRS."
      isDeleting={collection.busy} errorMessage={collection.error} onCancel={() => setDeleteTarget(null)} onConfirm={async () => {
        if (await collection.mutate(`/api/admin/vocabularies/${deleteTarget.id}`, "DELETE")) setDeleteTarget(null);
      }} />}
  </section>;
}
