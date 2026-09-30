import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/shared/auth/session";
import { adminService } from "@/modules/admin/admin.service";
import { LessonsTable } from "@/components/admin/lessons-table";

export default async function AdminChapterLessonsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return null;
  }

  const { id } = await params;
  let chapter;
  try {
    chapter = await adminService.getChapterById(session.user, id);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
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
            <Link
              href={`/admin/courses/${chapter.course.id}/edit`}
              className="hover:text-white transition-colors"
            >
              {chapter.course.title}
            </Link>
            <span>/</span>
            <span className="text-slate-200 font-medium">{chapter.title}</span>
          </nav>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Quản lý Bài học: {chapter.title}
          </h1>
          <p className="text-xs text-slate-400">
            Thuộc khóa học: <strong className="text-slate-200">{chapter.course.title}</strong>
          </p>
        </div>

        <Link
          href={`/admin/courses/${chapter.course.id}/edit`}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          ← Quay lại Khóa học
        </Link>
      </div>

      {/* Lessons Table */}
      <LessonsTable chapterId={chapter.id} initialLessons={chapter.lessons} />
    </div>
  );
}
