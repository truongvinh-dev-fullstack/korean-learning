import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { lessonService } from "@/modules/lessons/lesson.service";
import { exerciseService } from "@/modules/exercises/exercise.service";
import { progressService } from "@/modules/progress/progress.service";
import { getServerSession } from "@/shared/auth/session";
import { LessonBlockRenderer } from "@/components/lessons/lesson-block-renderer";
import { LessonNavigation } from "@/components/lessons/lesson-navigation";
import { LessonProgressAction } from "@/components/lessons/lesson-progress-action";
import { ExerciseRunner } from "@/components/exercises/exercise-runner";
import { LessonProgressStatus } from "@prisma/client";

interface LessonPageProps {
  params: Promise<{
    slug: string;
    lessonSlug: string;
  }>;
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { lessonSlug } = await params;
  const lessonData = await lessonService.getPublishedLessonBySlug(lessonSlug);

  if (!lessonData) {
    return { title: "Không tìm thấy bài học - Korean Zero" };
  }

  return {
    title: `${lessonData.title} - ${lessonData.chapter.course.title} | Korean Zero`,
    description: lessonData.summary || `Bài học tiếng Hàn: ${lessonData.title}`,
  };
}

export default async function LessonReaderPage({ params }: LessonPageProps) {
  const { slug: courseSlug, lessonSlug } = await params;
  const navData = await lessonService.getPublishedLessonWithNavigation(lessonSlug);

  if (!navData) {
    notFound();
  }

  const { lesson, previousLesson, nextLesson, totalCourseLessons, currentLessonIndex } =
    navData;

  const session = await getServerSession();
  const user = session?.user;

  let userStatus: LessonProgressStatus = LessonProgressStatus.NOT_STARTED;
  if (user) {
    userStatus = await progressService.getLessonStatus(user.id, lesson.id);
  }

  const exercises = await exerciseService.getLessonExercisesForStudent(lesson.id);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        <Link href="/" className="hover:text-white transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/courses" className="hover:text-white transition-colors">
          Khóa học
        </Link>
        <span>/</span>
        <Link href={`/courses/${courseSlug}`} className="hover:text-white transition-colors">
          {lesson.chapter.course.title}
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium truncate max-w-[200px]">
          {lesson.title}
        </span>
      </nav>

      {/* Lesson Header */}
      <header className="space-y-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
              {lesson.chapter.title}
            </span>
            <span className="text-xs text-slate-400">
              Bài {currentLessonIndex} / {totalCourseLessons}
            </span>
          </div>

          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <span>⏱ Thời lượng: ~{lesson.estimatedMinutes} phút</span>
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
          {lesson.title}
        </h1>

        {lesson.summary && (
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            {lesson.summary}
          </p>
        )}
      </header>

      {/* Progress Action Bar */}
      <LessonProgressAction
        lessonId={lesson.id}
        initialStatus={userStatus}
        courseSlug={courseSlug}
        nextLessonSlug={nextLesson?.slug}
        isAuthenticated={Boolean(user)}
      />

      {/* Structured Content Blocks */}
      <main className="space-y-6">
        {lesson.blocks.map((block) => (
          <LessonBlockRenderer key={block.id} block={block} />
        ))}
      </main>

      {/* Vocabulary Summary Table if lesson contains vocabularies */}
      {lesson.vocabularies.length > 0 && (
        <section className="space-y-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Tổng hợp từ vựng trong bài ({lesson.vocabularies.length} từ)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Từ vựng (Hangul)</th>
                  <th className="py-2.5 px-3">Phiên âm</th>
                  <th className="py-2.5 px-3">Nghĩa tiếng Việt</th>
                  <th className="py-2.5 px-3">Loại từ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {lesson.vocabularies.map((vocab) => (
                  <tr key={vocab.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-bold text-white text-base">
                      {vocab.hangul}
                    </td>
                    <td className="py-3 px-3 font-mono text-indigo-400">
                      {vocab.romanization}
                    </td>
                    <td className="py-3 px-3 text-emerald-300">
                      {vocab.vietnameseMeaning}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {vocab.partOfSpeech || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Exercise Section */}
      {exercises.length > 0 && (
        <section className="space-y-6 pt-4 border-t border-slate-800/80">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-800/50 text-violet-300 text-xs font-semibold">
              <span>✍️</span> Luyện tập & Đánh giá năng lực
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Bài tập củng cố kiến thức
            </h2>
            <p className="text-sm text-slate-300">
              Vượt qua bài kiểm tra với điểm số từ 80% trở lên để được hệ thống tự động xác nhận hoàn thành bài học và duy trì chuỗi ngày học Streak!
            </p>
          </div>

          <div className="space-y-8">
            {exercises.map((exercise) => (
              <ExerciseRunner
                key={exercise.id}
                exercise={exercise}
                isAuthenticated={Boolean(user)}
                courseSlug={courseSlug}
                lessonSlug={lessonSlug}
                nextLessonSlug={nextLesson?.slug}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sequential Navigation: Previous / Next Lesson */}
      <LessonNavigation
        courseSlug={courseSlug}
        previousLesson={previousLesson}
        nextLesson={nextLesson}
      />
    </div>
  );
}
