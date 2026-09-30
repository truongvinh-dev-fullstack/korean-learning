import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { courseService } from "@/modules/courses/course.service";
import { progressService } from "@/modules/progress/progress.service";
import { getServerSession } from "@/shared/auth/session";
import { EnrollButton } from "@/components/courses/enroll-button";
import { ProgressBar } from "@/components/ui/progress-bar";

interface CourseDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await courseService.getCourseBySlug(slug);

  if (!course) {
    return {
      title: "Không tìm thấy khóa học - Korean Zero",
    };
  }

  return {
    title: `${course.title} - Korean Zero (한국어 제lo)`,
    description: course.description,
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { slug } = await params;
  const course = await courseService.getCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  const session = await getServerSession();
  const user = session?.user;

  const isEnrolled = user ? await courseService.isStudentEnrolled(user.id, course.id) : false;
  const courseProgress = user ? await progressService.getCourseProgress(user.id, course.id) : null;

  const totalLessons = course.chapters.reduce(
    (total, ch) => total + ch.lessons.length,
    0
  );

  const totalMinutes = course.chapters.reduce(
    (total, ch) =>
      total + ch.lessons.reduce((subTotal, l) => subTotal + (l.estimatedMinutes || 15), 0),
    0
  );

  const firstLesson = course.chapters[0]?.lessons[0];

  const levelLabels: Record<string, string> = {
    BEGINNER: "Căn bản cho người mới",
    INTERMEDIATE: "Trung cấp",
    ADVANCED: "Nâng cao",
  };

  const levelDisplay = levelLabels[course.level] || course.level;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-white transition-colors focus-visible:outline-none focus-visible:underline">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/courses" className="hover:text-white transition-colors focus-visible:outline-none focus-visible:underline">
          Khóa học
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-none">
          {course.title}
        </span>
      </nav>

      {/* Course Hero & Details */}
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/80 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6 relative">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
              {levelDisplay}
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Miễn phí 100%
            </span>
            <span className="text-xs text-slate-400">
              Cập nhật mới nhất • {course.chapters.length} chương • {totalLessons} bài học • ~{Math.round(totalMinutes / 60)} giờ học
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {course.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
            {course.description}
          </p>

          {/* Progress Bar if user is enrolled and has progress */}
          {courseProgress && isEnrolled && (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Tiến độ học tập của bạn</span>
                <span className="font-bold text-indigo-400">
                  {courseProgress.completedLessons}/{courseProgress.totalLessons} bài học ({courseProgress.progressPercentage}%)
                </span>
              </div>
              <ProgressBar
                value={courseProgress.progressPercentage}
                variant={courseProgress.progressPercentage === 100 ? "emerald" : "indigo"}
                size="md"
              />
            </div>
          )}

          {/* Enrollment Call To Action Box */}
          <div className="pt-4 border-t border-slate-800/80">
            {user ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-indigo-950/30 border border-indigo-900/40">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-indigo-200">
                    {isEnrolled ? "Bạn đã đăng ký khóa học này" : "Đăng ký tham gia ngay"}
                  </p>
                  <p className="text-xs text-slate-300">
                    {isEnrolled
                      ? courseProgress?.nextLesson
                        ? `Bài học tiếp theo: ${courseProgress.nextLesson.title}`
                        : "Bạn đã hoàn thành tất cả các bài học trong khóa này!"
                      : "Nhấp nút bên dưới để ghi nhận tiến độ và bắt đầu học tập."}
                  </p>
                </div>

                <EnrollButton
                  courseId={course.id}
                  courseSlug={course.slug}
                  firstLessonSlug={courseProgress?.nextLesson?.slug || firstLesson?.slug}
                  isEnrolled={isEnrolled}
                  isAuthenticated={true}
                />
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 to-slate-900/60 border border-indigo-800/40">
                <div className="space-y-1.5 max-w-xl">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>✨</span>
                    <span>Đăng ký tham gia khóa học hoàn toàn miễn phí</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Khóa học mở tự do cho mọi người. Bạn chỉ cần tạo một tài khoản để hệ thống lưu lại điểm số bài tập, tiến độ bài học và từ vựng Spaced Repetition (SRS).
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
                  <Link
                    href={`/dang-ky?callbackUrl=${encodeURIComponent(`/courses/${course.slug}`)}`}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white text-center shadow-lg shadow-indigo-600/25 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                  >
                    Đăng ký học miễn phí
                  </Link>
                  <Link
                    href={`/dang-nhap?callbackUrl=${encodeURIComponent(`/courses/${course.slug}`)}`}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 text-center border border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                  >
                    Đăng nhập
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Syllabus Outline (Chapters & Lessons) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Giáo trình chi tiết
            </h2>
            <p className="text-sm text-slate-400">
              Lộ trình từng bước giúp bạn nắm vững kiến thức ngữ pháp và phát âm
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {course.chapters.length} Chương • {totalLessons} Bài học
          </span>
        </div>

        <div className="space-y-6">
          {course.chapters.map((chapter, chapterIdx) => (
            <div
              key={chapter.id}
              className="rounded-2xl bg-slate-900/50 border border-slate-800/80 overflow-hidden shadow-lg"
            >
              {/* Chapter Header */}
              <div className="p-5 sm:p-6 bg-slate-900/90 border-b border-slate-800/80">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Chương {chapterIdx + 1}
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {chapter.title}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium shrink-0">
                    {chapter.lessons.length} bài học
                  </span>
                </div>
                {chapter.description && (
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    {chapter.description}
                  </p>
                )}
              </div>

              {/* Lesson List */}
              <div className="divide-y divide-slate-800/60 p-2 sm:p-4">
                {chapter.lessons.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 italic">
                    Chương này chưa có bài học nào được công khai.
                  </p>
                ) : (
                  chapter.lessons.map((lesson, lessonIdx) => (
                    <Link
                      key={lesson.id}
                      href={`/courses/${course.slug}/lessons/${lesson.slug}`}
                      className="group p-3.5 sm:p-4 rounded-xl hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 block"
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {lessonIdx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-200 transition-colors">
                            {lesson.title}
                          </h4>
                          {lesson.summary && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                              {lesson.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                        <span className="text-xs text-slate-400">
                          ⏱ {lesson.estimatedMinutes} phút
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                          {lesson.status === "PUBLISHED" ? "Công khai • Miễn phí" : "Sắp ra mắt"}
                        </span>
                        <span className="text-xs text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          Học →
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
