"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { LessonFormSchema } from "@/modules/admin/admin.schema";

export interface LessonRow {
  id: string;
  chapterId: string;
  slug: string;
  title: string;
  summary: string | null;
  estimatedMinutes: number;
  displayOrder: number;
  status: ContentStatus;
  _count: {
    blocks: number;
    vocabularies: number;
    exercises: number;
    progresses: number;
  };
}

export function LessonsTable({
  chapterId,
  initialLessons,
}: {
  chapterId: string;
  initialLessons: LessonRow[];
}) {
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonRow[]>(initialLessons);
  const [isReordering, setIsReordering] = useState(false);

  // Quick Add Lesson Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    summary: string;
    estimatedMinutes: number;
    status: ContentStatus;
  }>({
    title: "",
    slug: "",
    summary: "",
    estimatedMinutes: 15,
    status: ContentStatus.DRAFT,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formServerError, setFormServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<LessonRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setFormServerError(null);

    const parseResult = LessonFormSchema.safeParse({
      ...formData,
      chapterId,
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
      const res = await fetch("/api/admin/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi tạo bài học.");
      }

      setIsAddOpen(false);
      // Navigate to lesson editor
      router.push(`/admin/lessons/${data.data.id}/edit`);
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
      const res = await fetch(`/api/admin/lessons/${id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLessons(data.data);
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
      const res = await fetch(`/api/admin/lessons/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi xóa bài học.");
      }

      setLessons((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Danh sách Bài học ({lessons.length})
          </h2>
          <p className="text-xs text-slate-400">
            Sắp xếp thứ tự và quản lý các bài học trong chương này
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormData({
              title: "",
              slug: "",
              summary: "",
              estimatedMinutes: 15,
              status: ContentStatus.DRAFT,
            });
            setFormErrors({});
            setFormServerError(null);
            setIsAddOpen(true);
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          + Thêm bài học mới
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-slate-900/60 border border-slate-800">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-950/70 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-center w-16">Thứ tự</th>
              <th className="px-4 py-3">Bài học</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-center">Khối nội dung</th>
              <th className="px-4 py-3 text-center">Từ vựng</th>
              <th className="px-4 py-3 text-center">Bài tập</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {lessons.map((lesson, idx) => (
              <tr key={lesson.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || isReordering}
                      onClick={() => handleReorder(lesson.id, "UP")}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
                      title="Di chuyển lên"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === lessons.length - 1 || isReordering}
                      onClick={() => handleReorder(lesson.id, "DOWN")}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
                      title="Di chuyển xuống"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">{lesson.title}</span>
                    <span className="text-[11px] text-slate-400 block">
                      ⏱ {lesson.estimatedMinutes} phút
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-300">
                  {lesson.slug}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      lesson.status === ContentStatus.PUBLISHED
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : "bg-amber-950/80 text-amber-300 border-amber-700/60"
                    }`}
                  >
                    {lesson.status === ContentStatus.PUBLISHED ? "Đã xuất bản" : "Bản nháp"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-bold text-white">
                  {lesson._count?.blocks ?? 0}
                </td>
                <td className="px-4 py-3 text-center font-bold text-emerald-300">
                  {lesson._count?.vocabularies ?? 0}
                </td>
                <td className="px-4 py-3 text-center font-bold text-rose-300">
                  {lesson._count?.exercises ?? 0}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/lessons/${lesson.id}/preview`}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Xem trước bài học"
                    >
                      👁 Xem trước
                    </Link>
                    <Link
                      href={`/admin/lessons/${lesson.id}/edit`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors"
                    >
                      Soạn nội dung →
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(lesson);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 border border-rose-800/40 transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-xs">
                  Chưa có bài học nào trong chương này. Hãy nhấn &quot;+ Thêm bài học mới&quot; để
                  bắt đầu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Lesson Modal */}
      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 text-left">
            <h3 className="text-lg font-bold text-white">Thêm Bài học mới</h3>

            {formServerError && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                ⚠️ {formServerError}
              </div>
            )}

            <form onSubmit={handleCreateLesson} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Tên bài học <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ví dụ: Bài 1: 10 Nguyên âm cơ bản"
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
                  placeholder="bai-1-nguyen-am-co-ban"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                />
                {formErrors.slug && <p className="text-xs text-rose-400">{formErrors.slug}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Tóm tắt bài học</label>
                <textarea
                  rows={2}
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Giới thiệu nội dung trọng tâm bài học..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Thời lượng (phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={formData.estimatedMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, estimatedMinutes: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.estimatedMinutes && (
                    <p className="text-xs text-rose-400">{formErrors.estimatedMinutes}</p>
                  )}
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
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? "Đang tạo..." : "Tạo & Soạn bài học →"}
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
          title="Xác nhận xóa bài học?"
          description="Hành động này sẽ xóa bài học. Theo quy tắc an toàn dữ liệu, hệ thống sẽ từ chối xóa nếu đã có học viên học bài này, đã có kết quả làm bài tập, hoặc từ vựng trong bài đã được nạp vào thẻ ôn tập SRS."
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
