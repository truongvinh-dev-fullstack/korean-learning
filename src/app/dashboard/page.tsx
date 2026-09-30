import { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/shared/auth/session";
import { dashboardService } from "@/modules/dashboard/dashboard.service";
import { CourseCard } from "@/components/ui/course-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SignOutButton } from "@/components/navigation/sign-out-button";

export const metadata: Metadata = {
  title: "Bảng học tập cá nhân - Korean Zero (한국어 제로)",
  description: "Theo dõi tiến độ học tiếng Hàn, chuỗi học tập và hàng đợi ôn tập thẻ SRS.",
};

export default async function DashboardPage() {
  const session = await requireStudent("/dashboard");
  const user = session.user;
  const dashboardData = await dashboardService.getStudentDashboardData(user);

  const { metrics, courses, continueLearning, hasActivity } = dashboardData;
  const isAdminUser = user.role === "ADMIN";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/80 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Bảng học tập cá nhân
            </h1>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isAdminUser
                  ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
                  : "bg-indigo-950/80 text-indigo-300 border-indigo-700/60"
              }`}
            >
              {isAdminUser ? "ADMIN" : "HỌC VIÊN"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Xin chào, <strong className="text-slate-200">{user.name}</strong> ({user.email}). Hãy duy trì thói quen học mỗi ngày!
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdminUser && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/40 hover:bg-amber-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
            >
              <span>⚙️</span>
              <span>Trang Quản trị</span>
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>

      {/* Admin Notice if user has ADMIN role */}
      {isAdminUser && (
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Quyền hạn Quản trị viên đang kích hoạt
              </p>
              <p className="text-xs text-amber-300/80">
                Bạn có toàn quyền biên soạn khóa học, chương học, bài tập và quản lý người dùng.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
          >
            Vào CMS Quản trị →
          </Link>
        </div>
      )}

      {/* Continue Learning Card */}
      {continueLearning && (
        <section aria-label="Tiếp tục bài học gần nhất">
          <div className="rounded-3xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-700/50 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm">
                    Tiếp tục học
                  </span>
                  <span className="text-xs text-indigo-300 font-medium">
                    {continueLearning.courseTitle}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  {continueLearning.lessonTitle}
                </h2>
                <p className="text-xs text-slate-400">
                  {continueLearning.chapterTitle} • Tiến độ khóa học: {continueLearning.progressPercentage}%
                </p>
              </div>

              <Link
                href={`/courses/${continueLearning.courseSlug}/lessons/${continueLearning.lessonSlug}`}
                className="w-full md:w-auto px-8 py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all text-center focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none shrink-0"
              >
                Vào bài học ngay →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Metrics Row (Streak, Completed Lessons, Words, Reviews) */}
      <section aria-label="Thống kê học tập" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Chuỗi học tập</span>
            <span className="text-amber-400 text-base">🔥</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white flex items-baseline gap-1">
              <span>{metrics.currentStreakDays}</span>
              <span className="text-xs font-medium text-slate-400">ngày</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Kỷ lục: {metrics.longestStreakDays} ngày
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Trạng thái:</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                metrics.studiedToday
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              {metrics.studiedToday ? "✔ Đã học hôm nay" : "Chưa học hôm nay"}
            </span>
          </div>
        </div>

        {/* Completed Lessons */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Bài học hoàn thành</span>
            <span className="text-indigo-400 text-base">📖</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics.completedLessonsCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {metrics.completedLessonsCount === 0 ? "Chưa hoàn thành bài nào" : "Tiến độ học tập"}
          </p>
        </div>

        {/* Words Learned */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Từ vựng đã nạp</span>
            <span className="text-emerald-400 text-base">🔤</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics.totalWordsLearned}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {metrics.totalWordsLearned === 0 ? "Bắt đầu học bài 1" : "Đã thêm vào bộ nhớ"}
          </p>
        </div>

        {/* SRS Review Queue */}
        <Link
          href="/on-tap"
          className="p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-purple-600/50 flex flex-col justify-between transition-all group focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="group-hover:text-purple-300 transition-colors">Ôn tập hôm nay</span>
            <span className="text-purple-400 text-base">🧠</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white flex items-baseline gap-1">
            <span>{metrics.srsDueCount}</span>
            <span className="text-xs font-medium text-slate-400">thẻ</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-slate-500">
              {metrics.srsDueCount === 0 ? "Đã ôn tập hết" : "Cần ôn tập ngay"}
            </p>
            {metrics.srsDueCount > 0 && (
              <span className="text-[10px] font-bold text-purple-400 group-hover:translate-x-0.5 transition-transform">
                Ôn ngay →
              </span>
            )}
          </div>
        </Link>
      </section>

      {/* Zero State Guidance Box when student has no activity yet */}
      {!hasActivity && (
        <section
          aria-label="Hướng dẫn bắt đầu"
          className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-slate-900 border border-indigo-800/50 shadow-xl"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold">
                <span>🚀 Khởi đầu hành trình</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Chào mừng bạn đến với Korean Zero!
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Tài khoản của bạn đã được thiết lập thành công. Hãy bắt đầu ngay với bài học đầu tiên trong khóa học <strong>Tiếng Hàn từ con số 0</strong> để tìm hiểu bảng chữ cái Hangul và bắt đầu chuỗi ngày học tập (Streak) của bạn.
              </p>
            </div>

            {courses[0] && (
              <Link
                href={`/courses/${courses[0].slug}`}
                className="px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none shrink-0"
              >
                Bắt đầu bài học đầu tiên →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Courses in Progress Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Khóa học của bạn
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Tiếp tục bài học gần nhất hoặc xem lại giáo trình
            </p>
          </div>
          <Link
            href="/courses"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Xem tất cả khóa học ({courses.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const actionHref = course.nextLesson
              ? `/courses/${course.slug}/lessons/${course.nextLesson.slug}`
              : `/courses/${course.slug}`;

            const actionText = !course.isEnrolled
              ? "Xem chi tiết khóa học"
              : course.progressPercentage === 100
              ? "Ôn tập giáo trình"
              : course.progressPercentage > 0
              ? "Tiếp tục học"
              : "Bắt đầu học";

            return (
              <CourseCard
                key={course.id}
                course={course}
                progress={course.isEnrolled ? course.progressPercentage : undefined}
                actionText={actionText}
                actionHref={actionHref}
                badgeText={
                  course.progressPercentage === 100
                    ? "Đã hoàn thành"
                    : course.isEnrolled
                    ? "Đã đăng ký"
                    : undefined
                }
              />
            );
          })}
        </div>
      </section>

      {/* Overall Progress Summary Bar */}
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
          <span>Tổng tiến độ toàn bộ giáo trình</span>
          <span className="font-bold text-indigo-300">
            {metrics.completedLessonsCount} bài đã hoàn thành
          </span>
        </div>
        <ProgressBar
          value={metrics.completedLessonsCount}
          max={courses.reduce((sum, c) => sum + (c.lessonCount || 8), 0) || 8}
          showPercentage
          size="md"
          variant="indigo"
        />
      </div>
    </div>
  );
}
