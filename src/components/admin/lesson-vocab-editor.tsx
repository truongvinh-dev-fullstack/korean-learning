"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { VocabularyFormSchema } from "@/modules/admin/admin.schema";

export interface VocabularyItem {
  id: string;
  lessonId: string;
  hangul: string;
  romanization: string;
  vietnameseMeaning: string;
  englishMeaning: string;
  partOfSpeech: string | null;
  audioUrl: string | null;
  exampleSentenceHangul: string | null;
  exampleSentenceVi: string | null;
  displayOrder: number;
  _count?: {
    reviewCards: number;
  };
}

export function LessonVocabEditor({
  lessonId,
  initialVocabularies,
}: {
  lessonId: string;
  initialVocabularies: VocabularyItem[];
}) {
  const router = useRouter();
  const [vocabs, setVocabs] = useState<VocabularyItem[]>(initialVocabularies);
  const [isReordering, setIsReordering] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState<VocabularyItem | null>(null);
  const [formData, setFormData] = useState({
    hangul: "",
    romanization: "",
    vietnameseMeaning: "",
    englishMeaning: "",
    partOfSpeech: "",
    audioUrl: "",
    exampleSentenceHangul: "",
    exampleSentenceVi: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formServerError, setFormServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<VocabularyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingVocab(null);
    setFormData({
      hangul: "",
      romanization: "",
      vietnameseMeaning: "",
      englishMeaning: "",
      partOfSpeech: "",
      audioUrl: "",
      exampleSentenceHangul: "",
      exampleSentenceVi: "",
    });
    setFormErrors({});
    setFormServerError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (v: VocabularyItem) => {
    setEditingVocab(v);
    setFormData({
      hangul: v.hangul,
      romanization: v.romanization,
      vietnameseMeaning: v.vietnameseMeaning,
      englishMeaning: v.englishMeaning || "",
      partOfSpeech: v.partOfSpeech || "",
      audioUrl: v.audioUrl || "",
      exampleSentenceHangul: v.exampleSentenceHangul || "",
      exampleSentenceVi: v.exampleSentenceVi || "",
    });
    setFormErrors({});
    setFormServerError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setFormServerError(null);

    const parseResult = VocabularyFormSchema.safeParse({
      ...formData,
      lessonId,
    });

    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const key = issue.path[0];
        if (key && !fieldErrors[key.toString()]) {
          fieldErrors[key.toString()] = issue.message;
        }
      });
      setFormErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const url = editingVocab
        ? `/api/admin/vocabularies/${editingVocab.id}`
        : `/api/admin/lessons/${lessonId}/vocabularies`;
      const method = editingVocab ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi lưu từ vựng.");
      }

      setIsModalOpen(false);

      // Refresh list
      const fetchList = await fetch(`/api/admin/lessons/${lessonId}/vocabularies`);
      const listData = await fetchList.json();
      if (listData.success) {
        setVocabs(listData.data);
      }
      router.refresh();
    } catch (err: unknown) {
      setFormServerError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReorder = async (id: string, direction: "UP" | "DOWN") => {
    if (isReordering) return;
    setIsReordering(true);
    try {
      const res = await fetch(`/api/admin/vocabularies/${id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVocabs(data.data);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setIsReordering(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/vocabularies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi xóa từ vựng.");
      }

      setVocabs((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">3. Ngân hàng Từ vựng của bài ({vocabs.length})</h3>
          <p className="text-xs text-slate-400">
            Từ vựng này sẽ tự động nạp vào hàng đợi ôn tập thẻ Spaced Repetition (SRS) khi học viên hoàn thành bài học
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          + Thêm từ vựng
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-slate-950/60 border border-slate-800">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-3 py-2.5 text-center w-14">Thứ tự</th>
              <th className="px-3 py-2.5">Từ vựng (Hangeul)</th>
              <th className="px-3 py-2.5">Phiên âm</th>
              <th className="px-3 py-2.5">Nghĩa tiếng Việt</th>
              <th className="px-3 py-2.5">Từ loại</th>
              <th className="px-3 py-2.5">Phát âm</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {vocabs.map((v, idx) => (
              <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0 || isReordering}
                      onClick={() => handleReorder(v.id, "UP")}
                      className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] disabled:opacity-20 cursor-pointer"
                      title="Lên"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === vocabs.length - 1 || isReordering}
                      onClick={() => handleReorder(v.id, "DOWN")}
                      className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] disabled:opacity-20 cursor-pointer"
                      title="Xuống"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-bold text-base text-white">{v.hangul}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-indigo-400">[{v.romanization}]</td>
                <td className="px-3 py-2.5 text-emerald-300 font-medium text-xs">
                  {v.vietnameseMeaning}
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{v.partOfSpeech || "—"}</td>
                <td className="px-3 py-2.5 text-xs">
                  {v.audioUrl ? (
                    <span className="text-emerald-400 font-mono text-[11px]" title={v.audioUrl}>
                      🔊 Có audio
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(v)}
                      className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(v);
                      }}
                      className="px-2 py-1 rounded text-xs bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 border border-rose-800/40 cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vocabs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-xs">
                  Chưa có từ vựng nào trong bài học này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Vocabulary Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="max-w-lg w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">
              {editingVocab ? "Chỉnh sửa Từ vựng" : "Thêm Từ vựng mới"}
            </h3>

            {formServerError && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                ⚠️ {formServerError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Từ tiếng Hàn (Hangeul) *
                  </label>
                  <input
                    type="text"
                    value={formData.hangul}
                    onChange={(e) => setFormData({ ...formData, hangul: e.target.value })}
                    placeholder="Ví dụ: 사과"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-base font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.hangul && <p className="text-xs text-rose-400">{formErrors.hangul}</p>}
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Phiên âm Romanization *
                  </label>
                  <input
                    type="text"
                    value={formData.romanization}
                    onChange={(e) => setFormData({ ...formData, romanization: e.target.value })}
                    placeholder="sagwa"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.romanization && (
                    <p className="text-xs text-rose-400">{formErrors.romanization}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Nghĩa tiếng Việt *
                  </label>
                  <input
                    type="text"
                    value={formData.vietnameseMeaning}
                    onChange={(e) => setFormData({ ...formData, vietnameseMeaning: e.target.value })}
                    placeholder="Quả táo"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.vietnameseMeaning && (
                    <p className="text-xs text-rose-400">{formErrors.vietnameseMeaning}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Nghĩa tiếng Anh</label>
                  <input
                    type="text"
                    value={formData.englishMeaning}
                    onChange={(e) => setFormData({ ...formData, englishMeaning: e.target.value })}
                    placeholder="Apple"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Từ loại</label>
                  <input
                    type="text"
                    value={formData.partOfSpeech}
                    onChange={(e) => setFormData({ ...formData, partOfSpeech: e.target.value })}
                    placeholder="Danh từ, Động từ..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Audio URL</label>
                  <input
                    type="text"
                    value={formData.audioUrl}
                    onChange={(e) => setFormData({ ...formData, audioUrl: e.target.value })}
                    placeholder="/audio/vocab/sagwa.mp3"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.audioUrl && (
                    <p className="text-xs text-rose-400">{formErrors.audioUrl}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Câu ví dụ tiếng Hàn</label>
                <input
                  type="text"
                  value={formData.exampleSentenceHangul}
                  onChange={(e) =>
                    setFormData({ ...formData, exampleSentenceHangul: e.target.value })
                  }
                  placeholder="사과가 맛있어요."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Dịch nghĩa câu ví dụ</label>
                <input
                  type="text"
                  value={formData.exampleSentenceVi}
                  onChange={(e) => setFormData({ ...formData, exampleSentenceVi: e.target.value })}
                  placeholder="Táo rất ngon."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? "Đang lưu..." : editingVocab ? "Lưu thay đổi" : "Thêm từ vựng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmDialog
          isOpen={Boolean(deleteTarget)}
          title="Xác nhận xóa từ vựng?"
          description="Hành động này sẽ xóa từ vựng khỏi bài học. Hệ thống sẽ từ chối xóa nếu từ vựng này đã được nạp vào thẻ ôn tập Spaced Repetition (SRS) của bất kỳ học viên nào."
          itemName={deleteTarget.hangul}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onConfirm={handleDelete}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        />
      )}
    </div>
  );
}
