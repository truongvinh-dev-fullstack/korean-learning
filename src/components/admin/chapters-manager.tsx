"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { ChapterFormSchema } from "@/modules/admin/admin.schema";

export interface ChapterItem {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string | null;
  displayOrder: number;
  status: ContentStatus;
  _count: {
    lessons: number;
  };
}

export function ChaptersManager({
  courseId,
  initialChapters,
}: {
  courseId: string;
  initialChapters: ChapterItem[];
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterItem[]>(initialChapters);
  const [isReordering, setIsReordering] = useState(false);

  // Modal / Form state for Add or Edit
  const [editingChapter, setEditingChapter] = useState<ChapterItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    description: string;
    status: ContentStatus;
  }>({
    title: "",
    slug: "",
    description: "",
    status: ContentStatus.DRAFT,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formServerError, setFormServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ChapterItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingChapter(null);
    setFormData({
      title: "",
      slug: "",
      description: "",
      status: ContentStatus.DRAFT,
    });
    setFormErrors({});
    setFormServerError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (chapter: ChapterItem) => {
    setEditingChapter(chapter);
    setFormData({
      title: chapter.title,
      slug: chapter.slug,
      description: chapter.description || "",
      status: chapter.status,
    });
    setFormErrors({});
    setFormServerError(null);
    setIsFormOpen(true);
  };

  const generateSlug = () => {
    const raw = formData.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    setFormData((prev) => ({ ...prev, slug: raw }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setFormServerError(null);

    const parseResult = ChapterFormSchema.safeParse({
      ...formData,
      courseId,
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
      const url = editingChapter
        ? `/api/admin/chapters/${editingChapter.id}`
        : "/api/admin/chapters";
      const method = editingChapter ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi lưu chương học.");
      }

      setIsFormOpen(false);
      // Refresh list
      const fetchList = await fetch(`/api/admin/chapters?courseId=${courseId}`);
      const listData = await fetchList.json();
      if (listData.success) {
        setChapters(listData.data);
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
      const res = await fetch(`/api/admin/chapters/${id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChapters(data.data);
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
      const res = await fetch(`/api/admin/chapters/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi xóa chương học.");
      }

      setChapters((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pt-6 border-t border-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Danh sách Chương học ({chapters.length})
          </h2>
          <p className="text-xs text-slate-400">
            Sắp xếp thứ tự và quản lý các chương trong khóa học này
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          + Thêm chương mới
        </button>
      </div>

      {/* Chapters Table */}
      <div className="overflow-x-auto rounded-2xl bg-slate-900/60 border border-slate-800">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-950/70 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-center w-16">Thứ tự</th>
              <th className="px-4 py-3">Tên chương</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-center">Bài học</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {chapters.map((ch, idx) => (
              <tr key={ch.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || isReordering}
                      onClick={() => handleReorder(ch.id, "UP")}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
                      title="Di chuyển lên"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === chapters.length - 1 || isReordering}
                      onClick={() => handleReorder(ch.id, "DOWN")}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
                      title="Di chuyển xuống"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">{ch.title}</span>
                    {ch.description && (
                      <span className="text-[11px] text-slate-400 block line-clamp-1">
                        {ch.description}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-300">{ch.slug}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      ch.status === ContentStatus.PUBLISHED
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : "bg-amber-950/80 text-amber-300 border-amber-700/60"
                    }`}
                  >
                    {ch.status === ContentStatus.PUBLISHED ? "Xuất bản" : "Bản nháp"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-bold text-white">
                  {ch._count?.lessons ?? 0}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/chapters/${ch.id}/lessons`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors"
                    >
                      Quản lý bài học ({ch._count?.lessons ?? 0}) →
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEditModal(ch)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(ch);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 border border-rose-800/40 transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {chapters.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                  Chưa có chương học nào trong khóa học này. Hãy nhấn &quot;+ Thêm chương mới&quot;
                  để bắt đầu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Chapter Modal */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 text-left">
            <h3 className="text-lg font-bold text-white">
              {editingChapter ? "Chỉnh sửa Chương học" : "Thêm Chương học mới"}
            </h3>

            {formServerError && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                ⚠️ {formServerError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Tên chương <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ví dụ: Chương 1: Bảng chữ cái Hangeul"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                {formErrors.title && <p className="text-xs text-rose-400">{formErrors.title}</p>}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Slug <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateSlug}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    Tự động tạo
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                  }
                  placeholder="chuong-1-bang-chu-cai"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                />
                {formErrors.slug && <p className="text-xs text-rose-400">{formErrors.slug}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả mục tiêu của chương học..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Trạng thái</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as ContentStatus })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={ContentStatus.DRAFT}>Bản nháp (DRAFT)</option>
                  <option value={ContentStatus.PUBLISHED}>Đã xuất bản (PUBLISHED)</option>
                  <option value={ContentStatus.ARCHIVED}>Lưu trữ (ARCHIVED)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? "Đang lưu..." : editingChapter ? "Lưu thay đổi" : "Tạo chương"}
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
          title="Xác nhận xóa chương học?"
          description="Hành động này sẽ xóa chương học. Hệ thống sẽ từ chối xóa nếu bất kỳ bài học nào trong chương đã có học viên học hoặc hoàn thành."
          itemName={deleteTarget.title}
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
