"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { LessonFormSchema } from "@/modules/admin/admin.schema";

export interface LessonMetaData {
  id: string;
  chapterId: string;
  title: string;
  slug: string;
  summary: string | null;
  estimatedMinutes: number;
  status: ContentStatus;
  displayOrder: number;
}

export function LessonMetaEditor({ lesson }: { lesson: LessonMetaData }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: lesson.title,
    slug: lesson.slug,
    summary: lesson.summary || "",
    estimatedMinutes: lesson.estimatedMinutes,
    status: lesson.status,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);
    setSuccessMessage(null);

    const parseResult = LessonFormSchema.partial().safeParse(formData);
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
      const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi lưu thông tin bài học.");
      }

      setSuccessMessage("Đã lưu thông tin bài học thành công!");
      router.refresh();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 className="text-base font-bold text-white">1. Thông tin chung của Bài học</h3>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              formData.status === ContentStatus.PUBLISHED
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                : "bg-amber-950/80 text-amber-300 border-amber-700/60"
            }`}
          >
            {formData.status === ContentStatus.PUBLISHED ? "ĐÃ XUẤT BẢN" : "BẢN NHÁP (DRAFT)"}
          </span>
        </div>
      </div>

      {serverError && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
          ⚠️ {serverError}
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs">
          ✔ {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-300">
            Tiêu đề bài học <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          {errors.title && <p className="text-xs text-rose-400">{errors.title}</p>}
        </div>

        {/* Slug */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-300">
            Đường dẫn (Slug URL) <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) =>
              setFormData({ ...formData, slug: e.target.value.toLowerCase() })
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
          />
          {errors.slug && <p className="text-xs text-rose-400">{errors.slug}</p>}
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-300">Tóm tắt nội dung</label>
        <textarea
          rows={2}
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Estimated minutes */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-300">
            Thời lượng ước tính (phút)
          </label>
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
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-300">
            Trạng thái xuất bản (Workflow)
          </label>
          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as ContentStatus })
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value={ContentStatus.DRAFT}>Bản nháp (DRAFT) - Học viên chưa thấy</option>
            <option value={ContentStatus.PUBLISHED}>Đã xuất bản (PUBLISHED) - Học viên thấy</option>
            <option value={ContentStatus.ARCHIVED}>Lưu trữ (ARCHIVED)</option>
          </select>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? "Đang lưu..." : "Lưu thông tin bài học"}
        </button>
      </div>
    </form>
  );
}
