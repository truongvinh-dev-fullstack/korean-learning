import Link from "next/link";
import { getServerSession } from "@/shared/auth/session";
import { CourseForm } from "@/components/admin/course-form";

export default async function AdminNewCoursePage() {
  const session = await getServerSession();
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/admin" className="hover:text-white transition-colors">
              CMS Quản trị
            </Link>
            <span>/</span>
            <Link href="/admin/courses" className="hover:text-white transition-colors">
              Khóa học
            </Link>
            <span>/</span>
            <span className="text-slate-200 font-medium">Tạo mới</span>
          </nav>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Tạo Khóa học mới
          </h1>
          <p className="text-xs text-slate-400">
            Thiết lập thông tin cơ bản cho khóa học tiếng Hàn
          </p>
        </div>

        <Link
          href="/admin/courses"
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          ← Quay lại
        </Link>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800">
        <CourseForm />
      </div>
    </div>
  );
}
