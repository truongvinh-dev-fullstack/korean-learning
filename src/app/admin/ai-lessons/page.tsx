import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/shared/auth/session";
import { adminService } from "@/modules/admin/admin.service";
import { AiLessonAuthoring } from "@/components/admin/ai-lesson/ai-lesson-authoring";
import { NotFoundError } from "@/shared/errors/domain-errors";

export default async function AiLessonPage({ searchParams }: { searchParams: Promise<{ chapterId?: string; lessonId?: string }> }) {
  const session = await getServerSession(); if (!session?.user || session.user.role !== "ADMIN") return null;
  const query = await searchParams;
  let lesson;
  try { lesson = query.lessonId ? await adminService.getLessonById(session.user, query.lessonId) : null; }
  catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  const chapterId = lesson?.chapterId ?? query.chapterId;
  if (!chapterId) notFound();
  let chapter;
  try { chapter = await adminService.getChapterById(session.user, chapterId); }
  catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"><Link className="text-sm text-slate-400" href={lesson ? `/admin/lessons/${lesson.id}/edit` : `/admin/chapters/${chapterId}/lessons`}>← Quay lại {lesson?.title ?? chapter.title}</Link>
    <h1 className="text-2xl font-bold text-white">AI Tạo bài học</h1>
    <AiLessonAuthoring chapterId={chapterId} lessonId={lesson?.id} lessonStatus={lesson?.status} mock={process.env.AI_LESSON_PROVIDER === "mock" && process.env.NODE_ENV !== "production"} />
  </main>;
}
