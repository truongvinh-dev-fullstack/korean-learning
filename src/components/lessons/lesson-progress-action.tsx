"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LessonProgressStatus } from "@prisma/client";

export interface LessonProgressActionProps {
  lessonId: string;
  initialStatus: LessonProgressStatus;
  courseSlug: string;
  nextLessonSlug?: string | null;
  isAuthenticated: boolean;
}

export function LessonProgressAction({
  lessonId,
  initialStatus,
  courseSlug,
  nextLessonSlug,
  isAuthenticated,
}: LessonProgressActionProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LessonProgressStatus>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automatically mark lesson as STARTED if authenticated and not yet started
  useEffect(() => {
    if (isAuthenticated && status === LessonProgressStatus.NOT_STARTED) {
      fetch(`/api/lessons/${lessonId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START" }),
      })
        .then((res) => {
          if (res.ok) {
            setStatus(LessonProgressStatus.IN_PROGRESS);
          }
        })
        .catch(() => {
          // Non-blocking auto-start failure
        });
    }
  }, [isAuthenticated, lessonId, status]);

  const handleComplete = async () => {
    if (!isAuthenticated) {
      router.push(`/dang-nhap?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/lessons/${lessonId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Không thể cập nhật tiến độ.");
      }

      setStatus(LessonProgressStatus.COMPLETED);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCompleted = status === LessonProgressStatus.COMPLETED;

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Trạng thái học tập:</span>
            {isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Đã hoàn thành
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                Đang học
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isCompleted
              ? "Bạn đã hoàn thành bài học này. Tiến độ và chuỗi Streak đã được ghi nhận."
              : "Hoàn tất các khối lý thuyết bên dưới và bấm nút để lưu tiến độ học tập."}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isCompleted ? (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              {isSubmitting ? "Đang lưu..." : "✓ Đánh dấu hoàn thành bài học"}
            </button>
          ) : (
            nextLessonSlug && (
              <Link
                href={`/courses/${courseSlug}/lessons/${nextLessonSlug}`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all text-center focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
              >
                Học bài kế tiếp →
              </Link>
            )
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
