import { Metadata } from "next";
import { courseService } from "@/modules/courses/course.service";
import { CourseCard } from "@/components/ui/course-card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Danh mục khóa học - Korean Zero (한국어 제로)",
  description: "Các khóa học tiếng Hàn tương tác từ con số 0 dành cho người mới bắt đầu.",
};

export default async function CoursesPage() {
  const courses = await courseService.getPublishedCatalog();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
      {/* Header Banner */}
      <div className="space-y-4 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-xs font-semibold">
          <span>📚 Giáo trình chuẩn hoá</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Danh mục khóa học tiếng Hàn
        </h1>
        <p className="text-base text-slate-300 leading-relaxed">
          Tất cả các khóa học được thiết kế theo lộ trình sư phạm khoa học, giúp bạn tiếp cận
          tiếng Hàn một cách tự nhiên và bài bản nhất.
        </p>
      </div>

      {/* Course List / Empty State */}
      {courses.length === 0 ? (
        <EmptyState
          title="Chưa có khóa học nào được công khai"
          description="Đội ngũ giảng viên đang hoàn thiện các bài học chất lượng cao. Khóa học sẽ sớm xuất hiện tại đây."
          action={{
            label: "Về trang chủ",
            href: "/",
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              actionText="Xem giáo trình & Học"
              badgeText="Khuyên dùng"
            />
          ))}
        </div>
      )}
    </div>
  );
}
