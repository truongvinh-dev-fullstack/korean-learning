"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors
    console.error("Global application error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
      <ErrorState
        title="Đã xảy ra sự cố kỹ thuật"
        message="Hệ thống đã ghi nhận lỗi này. Bạn có thể thử tải lại trang hoặc quay về trang chủ."
        details={error.digest ? `Mã lỗi hệ thống: ${error.digest}` : undefined}
        onRetry={reset}
        homeHref="/"
      />
    </div>
  );
}
