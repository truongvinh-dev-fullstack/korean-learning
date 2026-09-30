import React from "react";
import Link from "next/link";
import { ProgressBar } from "./progress-bar";

export interface CourseCardProps {
  course: {
    id: string;
    slug: string;
    title: string;
    description: string;
    level: string;
    chapterCount?: number;
    lessonCount?: number;
  };
  actionText?: string;
  actionHref?: string;
  progress?: number;
  badgeText?: string;
  className?: string;
}

export function CourseCard({
  course,
  actionText = "Xem chi tiết khóa học",
  actionHref,
  progress,
  badgeText,
  className = "",
}: CourseCardProps) {
  const targetHref = actionHref || `/courses/${course.slug}`;

  const levelLabels: Record<string, string> = {
    BEGINNER: "Căn bản",
    INTERMEDIATE: "Trung cấp",
    ADVANCED: "Nâng cao",
  };

  const levelDisplay = levelLabels[course.level] || course.level;

  return (
    <div
      className={`p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-lg shadow-black/20 group ${className}`}
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
              {levelDisplay}
            </span>
            {badgeText && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                {badgeText}
              </span>
            )}
          </div>

          {(course.chapterCount !== undefined || course.lessonCount !== undefined) && (
            <span className="text-xs text-slate-400 font-medium">
              {course.chapterCount !== undefined && `${course.chapterCount} chương`}
              {course.chapterCount !== undefined && course.lessonCount !== undefined && " • "}
              {course.lessonCount !== undefined && `${course.lessonCount} bài học`}
            </span>
          )}
        </div>

        {/* Course Title & Description */}
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
          <Link href={targetHref} className="focus-visible:outline-none">
            {course.title}
          </Link>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-6 line-clamp-3">
          {course.description}
        </p>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-800/60">
        {progress !== undefined && (
          <ProgressBar
            value={progress}
            label="Tiến độ học tập"
            showPercentage
            size="sm"
            variant={progress === 100 ? "emerald" : "indigo"}
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Miễn phí 100%
          </span>
          <Link
            href={targetHref}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <span>{actionText}</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
