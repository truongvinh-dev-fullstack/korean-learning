// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CourseCard } from "@/components/ui/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, CourseCardSkeleton } from "@/components/ui/skeleton";

describe("ProgressBar Component", () => {
  it("renders accessible progressbar with 0% state", () => {
    render(<ProgressBar value={0} max={100} showPercentage />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeDefined();
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(screen.getByText("0%")).toBeDefined();
  });

  it("renders with 50% state and custom label", () => {
    render(
      <ProgressBar
        value={5}
        max={10}
        label="Tiến độ học tập"
        showPercentage
        variant="emerald"
      />
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText("Tiến độ học tập")).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("clamps values over 100%", () => {
    render(<ProgressBar value={120} max={100} showPercentage />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("100%")).toBeDefined();
  });
});

describe("CourseCard Component", () => {
  const mockCourse = {
    id: "course-123",
    slug: "tieng-han-tu-con-so-0",
    title: "Tiếng Hàn từ con số 0",
    description: "Khóa học căn bản nhất dành cho người bắt đầu từ chữ Hangul",
    level: "BEGINNER",
    chapterCount: 3,
    lessonCount: 8,
  };

  it("renders course information, badges and counts", () => {
    render(<CourseCard course={mockCourse} badgeText="Khuyên dùng" />);
    expect(screen.getByText("Tiếng Hàn từ con số 0")).toBeDefined();
    expect(
      screen.getByText("Khóa học căn bản nhất dành cho người bắt đầu từ chữ Hangul")
    ).toBeDefined();
    expect(screen.getByText("Căn bản")).toBeDefined();
    expect(screen.getByText("Khuyên dùng")).toBeDefined();
    expect(screen.getByText(/3 chương/)).toBeDefined();
    expect(screen.getByText(/8 bài học/)).toBeDefined();
  });

  it("renders progress bar when progress prop is provided", () => {
    render(<CourseCard course={mockCourse} progress={75} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("75");
    expect(screen.getByText("75%")).toBeDefined();
  });
});

describe("EmptyState Component", () => {
  it("renders empty state title and description", () => {
    render(
      <EmptyState
        title="Chưa có dữ liệu"
        description="Nội dung sẽ sớm được cập nhật."
      />
    );
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText("Chưa có dữ liệu")).toBeDefined();
    expect(screen.getByText("Nội dung sẽ sớm được cập nhật.")).toBeDefined();
  });

  it("renders action button and triggers onClick", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="Không tìm thấy kết quả"
        action={{
          label: "Thử lại",
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: "Thử lại" });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorState Component", () => {
  it("renders alert role with title and custom message", () => {
    render(
      <ErrorState
        title="Lỗi tải giáo trình"
        message="Không thể kết nối đến máy chủ cơ sở dữ liệu."
      />
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Lỗi tải giáo trình")).toBeDefined();
    expect(screen.getByText("Không thể kết nối đến máy chủ cơ sở dữ liệu.")).toBeDefined();
  });

  it("renders retry button and calls onRetry callback", () => {
    const handleRetry = vi.fn();
    render(
      <ErrorState
        title="Lỗi"
        onRetry={handleRetry}
      />
    );

    const retryBtn = screen.getByRole("button", { name: "Thử lại" });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});

describe("Skeleton Components", () => {
  it("renders base skeleton with pulse class and aria-hidden", () => {
    const { container } = render(<Skeleton className="w-20 h-4" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("animate-pulse");
  });

  it("renders CourseCardSkeleton without crashing", () => {
    const { container } = render(<CourseCardSkeleton />);
    expect(container.firstChild).toBeDefined();
  });
});
