"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { CourseFormSchema, CourseFormData } from "@/modules/admin/admin.schema";

export function CourseForm({
  initialData,
  courseId,
}: {
  initialData?: Partial<CourseFormData>;
  courseId?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(courseId);

  const [formData, setFormData] = useState<CourseFormData>({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    description: initialData?.description || "",
    level: initialData?.level || "BEGINNER",
    status: initialData?.status || ContentStatus.DRAFT,
    displayOrder: initialData?.displayOrder ?? 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to generate a slug from Vietnamese title
  const generateSlugFromTitle = () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const parseResult = CourseFormSchema.safeParse(formData);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const key = issue.path[0];
        if (key && !fieldErrors[key.toString()]) {
          fieldErrors[key.toString()] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/admin/courses/${courseId}`
        : "/api/admin/courses";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi lưu khóa học.");
      }

      router.push(isEditing ? `/admin/courses/${courseId}/edit` : "/admin/courses");
      router.refresh();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {serverError && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{serverError}</span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="course-title" className="block text-xs font-semibold text-slate-300">
          Tiêu đề khóa học <span className="text-rose-400">*</span>
        </label>
        <input
          id="course-title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Ví dụ: Tiếng Hàn từ con số 0"
          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {errors.title && <p className="text-xs text-rose-400">{errors.title}</p>}
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="course-slug" className="block text-xs font-semibold text-slate-300">
            Đường dẫn (Slug URL) <span className="text-rose-400">*</span>
          </label>
          <button
            type="button"
            onClick={generateSlugFromTitle}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            Tạo tự động từ tiêu đề
          </button>
        </div>
        <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-400 focus-within:border-indigo-500 transition-colors">
          <span className="text-slate-500 select-none font-mono text-xs">/courses/</span>
          <input
            id="course-slug"
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
            placeholder="tieng-han-tu-con-so-0"
            className="w-full bg-transparent px-2 text-white font-mono text-xs focus:outline-none"
          />
        </div>
        {errors.slug && <p className="text-xs text-rose-400">{errors.slug}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="course-desc" className="block text-xs font-semibold text-slate-300">
          Mô tả ngắn khóa học <span className="text-rose-400">*</span>
        </label>
        <textarea
          id="course-desc"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Khóa học nền tảng cho người mới bắt đầu học tiếng Hàn..."
          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {errors.description && <p className="text-xs text-rose-400">{errors.description}</p>}
      </div>

      {/* Level & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="course-level" className="block text-xs font-semibold text-slate-300">
            Cấp độ (Level)
          </label>
          <select
            id="course-level"
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="BEGINNER">Sơ cấp (Beginner)</option>
            <option value="ELEMENTARY">Sơ trung cấp (Elementary)</option>
            <option value="INTERMEDIATE">Trung cấp (Intermediate)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="course-status" className="block text-xs font-semibold text-slate-300">
            Trạng thái xuất bản
          </label>
          <select
            id="course-status"
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as ContentStatus })
            }
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value={ContentStatus.DRAFT}>Bản nháp (DRAFT) - Chưa công khai</option>
            <option value={ContentStatus.PUBLISHED}>Đã xuất bản (PUBLISHED) - Học viên thấy</option>
            <option value={ContentStatus.ARCHIVED}>Lưu trữ (ARCHIVED)</option>
          </select>
        </div>
      </div>

      <div className="pt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <span>{isEditing ? "Cập nhật khóa học" : "Tạo khóa học"}</span>
          )}
        </button>
      </div>
    </form>
  );
}
