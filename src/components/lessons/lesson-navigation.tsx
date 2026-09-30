import Link from "next/link";

export interface LessonNavTarget {
  id: string;
  slug: string;
  title: string;
  chapterTitle?: string;
}

export interface LessonNavigationProps {
  courseSlug: string;
  previousLesson: LessonNavTarget | null;
  nextLesson: LessonNavTarget | null;
  className?: string;
}

export function LessonNavigation({
  courseSlug,
  previousLesson,
  nextLesson,
  className = "",
}: LessonNavigationProps) {
  return (
    <nav
      aria-label="Điều hướng bài học"
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-8 border-t border-slate-800/80 ${className}`}
    >
      <div>
        {previousLesson ? (
          <Link
            href={`/courses/${courseSlug}/lessons/${previousLesson.slug}`}
            className="group flex flex-col p-3 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-400 transition-colors flex items-center gap-1">
              <span>←</span>
              <span>Bài trước</span>
            </span>
            <span className="text-sm font-bold text-white mt-1 group-hover:text-indigo-200 transition-colors line-clamp-1">
              {previousLesson.title}
            </span>
          </Link>
        ) : (
          <Link
            href={`/courses/${courseSlug}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition-colors"
          >
            <span>← Quay lại mục lục khóa học</span>
          </Link>
        )}
      </div>

      <div>
        {nextLesson ? (
          <Link
            href={`/courses/${courseSlug}/lessons/${nextLesson.slug}`}
            className="group flex flex-col items-end p-3 sm:p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 hover:border-indigo-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none text-right"
          >
            <span className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1">
              <span>Bài tiếp theo</span>
              <span>→</span>
            </span>
            <span className="text-sm font-bold text-white mt-1 group-hover:text-indigo-200 transition-colors line-clamp-1">
              {nextLesson.title}
            </span>
          </Link>
        ) : (
          <Link
            href={`/courses/${courseSlug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-colors"
          >
            <span>🎉 Hoàn thành toàn bộ khóa học</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
