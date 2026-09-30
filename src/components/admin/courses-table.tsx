"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

export interface CourseRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  status: ContentStatus;
  displayOrder: number;
  _count: {
    chapters: number;
    enrollments: number;
  };
}

export function CoursesTable({ initialCourses }: { initialCourses: CourseRow[] }) {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseRow[]>(initialCourses);
  const [isReordering, setIsReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleReorder = async (id: string, direction: "UP" | "DOWN") => {
    if (isReordering) return;
    setIsReordering(true);
    try {
      const res = await fetch(`/api/admin/courses/${id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCourses(data.data);
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
      const res = await fetch(`/api/admin/courses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi xóa khóa học.");
      }

      setCourses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
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
      <div className="overflow-x-auto rounded-2xl bg-slate-900/60 border border-slate-800">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-950/70 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-center w-16">Thứ tự</th>
              <th className="px-4 py-3">Khóa học</th>
              <th className="px-4 py-3">Đường dẫn (Slug)</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-center">Chương</th>
              <th className="px-4 py-3 text-center">Học viên</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {courses.map((course, idx) => (
              <tr key={course.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || isReordering}
                      onClick={() => handleReorder(course.id, "UP")}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
                      title="Di chuyển lên"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === courses.length - 1 || isReordering}
                      onClick={() => handleReorder(course.id, "DOWN")}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
                      title="Di chuyển xuống"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">{course.title}</span>
                    <span className="text-[11px] text-slate-400 block line-clamp-1 max-w-sm">
                      {course.description}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-300">
                  {course.slug}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      course.status === ContentStatus.PUBLISHED
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : course.status === ContentStatus.DRAFT
                        ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {course.status === ContentStatus.PUBLISHED
                      ? "Đã xuất bản"
                      : course.status === ContentStatus.DRAFT
                      ? "Bản nháp"
                      : "Lưu trữ"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-bold text-white">
                  {course._count.chapters}
                </td>
                <td className="px-4 py-3 text-center font-bold text-slate-300">
                  {course._count.enrollments}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/courses/${course.id}/edit`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors"
                    >
                      Quản lý & Sửa →
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(course);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 border border-rose-800/40 transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-xs">
                  Chưa có khóa học nào được tạo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <DeleteConfirmDialog
          isOpen={Boolean(deleteTarget)}
          title="Xác nhận xóa khóa học?"
          description="Hành động này sẽ xóa vĩnh viễn khóa học. Theo quy tắc an toàn dữ liệu, hệ thống sẽ từ chối xóa nếu đã có học viên đăng ký khóa học này."
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
