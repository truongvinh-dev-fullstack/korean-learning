"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface EnrollButtonProps {
  courseId: string;
  courseSlug: string;
  firstLessonSlug?: string;
  isEnrolled: boolean;
  isAuthenticated: boolean;
  className?: string;
}

export function EnrollButton({
  courseId,
  courseSlug,
  firstLessonSlug,
  isEnrolled,
  isAuthenticated,
  className = "",
}: EnrollButtonProps) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(isEnrolled);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const targetLessonHref = firstLessonSlug
    ? `/courses/${courseSlug}/lessons/${firstLessonSlug}`
    : `/dashboard`;

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      router.push(`/dang-nhap?callbackUrl=${encodeURIComponent(`/courses/${courseSlug}`)}`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Đăng ký khóa học thất bại.");
      }

      setEnrolled(true);
      router.refresh();
      router.push(targetLessonHref);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
      setIsLoading(false);
    }
  };

  if (enrolled) {
    return (
      <Link
        href={targetLessonHref}
        className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${className}`}
      >
        <span>Vào học ngay</span>
        <span>→</span>
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleEnroll}
        disabled={isLoading}
        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${className}`}
      >
        <span>{isLoading ? "Đang đăng ký..." : "Đăng ký khóa học ngay (Miễn phí)"}</span>
        <span>→</span>
      </button>

      {errorMessage && (
        <p className="text-xs text-rose-400 font-medium">⚠️ {errorMessage}</p>
      )}
    </div>
  );
}
