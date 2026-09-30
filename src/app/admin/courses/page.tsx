import Link from "next/link";
import { getServerSession } from "@/shared/auth/session";
import { adminService } from "@/modules/admin/admin.service";
import { CoursesTable } from "@/components/admin/courses-table";

export default async function AdminCoursesPage() {
  const session = await getServerSession();
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return null;
  }

  const courses = await adminService.getAllCourses(session.user);

  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-10 space-y-8">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/admin" className="hover:text-white transition-colors">
              CMS Quản trị
            </Link>
            <span>/</span>
            <span className="text-slate-200 font-medium">Khóa học</span>
          </nav>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Quản lý Khóa học & Giáo trình
          </h1>
          <p className="text-xs text-slate-400">
            Xem danh sách, sắp xếp thứ tự và quản lý cấu trúc chương học
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/courses/new"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            + Tạo khóa học mới
          </Link>
        </div>
      </div>

      {/* Courses Table */}
      <CoursesTable initialCourses={courses} />
    </div>
  );
}
