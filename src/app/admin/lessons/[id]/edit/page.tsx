import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/shared/auth/session";
import { adminService } from "@/modules/admin/admin.service";
import { LessonMetaEditor } from "@/components/admin/lesson-meta-editor";
import { LessonBlocksEditor } from "@/components/admin/lesson-blocks-editor";
import { LessonVocabEditor } from "@/components/admin/lesson-vocab-editor";
import { LessonExerciseEditor } from "@/components/admin/lesson-exercise-editor";
import { LessonObjectives } from "@/components/admin/lesson-detail/lesson-objectives";
import { NotFoundError } from "@/shared/errors/domain-errors";

export default async function AdminLessonEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return null;
  }

  const { id } = await params;
  let lesson;
  try {
    lesson = await adminService.getLessonById(session.user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
            <Link href="/admin" className="hover:text-white transition-colors">
              CMS Quản trị
            </Link>
            <span>/</span>
            <Link href="/admin/courses" className="hover:text-white transition-colors">
              Khóa học
            </Link>
            <span>/</span>
            <Link
              href={`/admin/courses/${lesson.chapter.course.id}/edit`}
              className="hover:text-white transition-colors"
            >
              {lesson.chapter.course.title}
            </Link>
            <span>/</span>
            <Link
              href={`/admin/chapters/${lesson.chapter.id}/lessons`}
              className="hover:text-white transition-colors"
            >
              {lesson.chapter.title}
            </Link>
            <span>/</span>
            <span className="text-slate-200 font-medium">{lesson.title}</span>
          </nav>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Soạn thảo Bài học: {lesson.title}
          </h1>
          <p className="text-xs text-slate-400">
            Chỉnh sửa nội dung kiến thức, từ vựng và câu hỏi bài tập củng cố
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href={`/admin/ai-lessons?lessonId=${lesson.id}`} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">AI tạo bài học</Link>
          <Link
            href={`/admin/lessons/${lesson.id}/preview`}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>👁</span>
            <span>Xem trước (Preview)</span>
          </Link>
          <Link
            href={`/admin/chapters/${lesson.chapter.id}/lessons`}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            ← Danh sách bài học
          </Link>
        </div>
      </div>

      {/* Editor Sections */}
      <div className="space-y-8">
        {/* Section 1: Lesson Meta */}
        <LessonMetaEditor lesson={lesson} />
        <LessonObjectives lessonId={lesson.id} initialObjectives={lesson.learningObjectives} />

        {/* Section 2: Lesson Blocks */}
        <LessonBlocksEditor lessonId={lesson.id} initialBlocks={lesson.blocks} vocabulary={lesson.vocabularies} />

        {/* Section 3: Lesson Vocabulary */}
        <LessonVocabEditor
          lessonId={lesson.id}
          initialVocabularies={lesson.vocabularies}
        />

        {/* Section 4: Lesson Exercises */}
        <LessonExerciseEditor
          lessonId={lesson.id}
          initialExercises={lesson.exercises}
        />
      </div>
    </div>
  );
}
