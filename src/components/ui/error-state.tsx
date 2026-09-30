import React from "react";
import Link from "next/link";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  details?: string;
  onRetry?: () => void;
  homeHref?: string;
  className?: string;
}

export function ErrorState({
  title = "Đã xảy ra lỗi không mong muốn",
  message = "Hệ thống gặp sự cố khi tải trang hoặc dữ liệu. Vui lòng thử lại sau giây lát.",
  details,
  onRetry,
  homeHref = "/",
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`p-6 sm:p-10 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-center max-w-xl mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-rose-900/30 text-rose-400 border border-rose-800/40 flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-7 h-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-bold text-rose-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed mb-4">{message}</p>

      {details && (
        <div className="mb-6 p-3 rounded-lg bg-black/40 border border-rose-900/30 text-xs font-mono text-rose-300/80 text-left overflow-x-auto">
          {details}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-900/30 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
          >
            Thử lại
          </button>
        )}

        {homeHref && (
          <Link
            href={homeHref}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
          >
            Về trang chủ
          </Link>
        )}
      </div>
    </div>
  );
}
