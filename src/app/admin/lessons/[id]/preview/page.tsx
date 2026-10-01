import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/shared/auth/session";
import { adminService } from "@/modules/admin/admin.service";
import { validateLessonBlockRecord } from "@/modules/lessons/lesson-block.schema";
import { LessonBlockRenderer } from "@/components/lessons/lesson-block-renderer";
import { VocabularyAudioButton } from "@/components/lessons/vocabulary-audio-button";
import { getVocabularyAudioUrl } from "@/shared/audio/vocabulary-audio";

export default async function AdminLessonPreviewPage({
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
    lesson = await adminService.getLessonPreview(session.user, id);
  } catch {
    notFound();
  }

  // Validate blocks safely for rendering
  const validatedBlocks = lesson.blocks.flatMap((rawBlock) => {
    try {
      return [validateLessonBlockRecord(rawBlock)];
    } catch {
      return [];
    }
  });

  return (
    <div className="min-h-screen pb-16">
      {/* Top Admin Preview Banner */}
      <div className="sticky top-0 z-40 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-amber-200">
            <span className="text-base">👁</span>
            <span>
              <strong>CHẾ ĐỘ XEM TRƯỚC (DRAFT PREVIEW):</strong> Trạng thái bài học:{" "}
              <span className="font-bold font-mono uppercase underline">
                {lesson.status}
              </span>
              . Hiển thị mô phỏng giao diện của học viên.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/admin/lessons/${lesson.id}/edit`}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
            >
              ← Quay lại soạn bài
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          <Link href="/admin/courses" className="hover:text-white transition-colors">
            Khóa học
          </Link>
          <span>/</span>
          <span className="text-slate-400">{lesson.chapter.course.title}</span>
          <span>/</span>
          <span className="text-slate-400">{lesson.chapter.title}</span>
          <span>/</span>
          <span className="text-slate-200 font-medium">{lesson.title}</span>
        </nav>

        {/* Lesson Header */}
        <header className="space-y-3 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
              Bài #{lesson.displayOrder + 1}
            </span>
            <span className="text-xs text-slate-400">
              ⏱ Khoảng {lesson.estimatedMinutes} phút học
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {lesson.title}
          </h1>
          {lesson.summary && (
            <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
              {lesson.summary}
            </p>
          )}
        </header>

        {/* Lesson Blocks Content Stream */}
        <div className="space-y-6">
          {validatedBlocks.map((block) => (
            <LessonBlockRenderer key={block.id} block={block} vocabularies={lesson.vocabularies} />
          ))}

          {validatedBlocks.length === 0 && (
            <div className="p-8 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
              Bài học này chưa có khối nội dung nào.
            </div>
          )}
        </div>

        {/* Vocabulary Section Preview */}
        {lesson.vocabularies.length > 0 && (
          <section className="space-y-4 p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Từ vựng trọng tâm ({lesson.vocabularies.length} từ)
                </h3>
                <p className="text-xs text-slate-400">
                  Ghi nhớ các từ vựng này để luyện tập và kích hoạt hàng đợi Spaced Repetition (SRS)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {lesson.vocabularies.map((vocab) => (
                <div
                  key={vocab.id}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-indigo-600/50 transition-colors flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-white font-sans">
                        {vocab.hangul}
                      </span>
                      <VocabularyAudioButton hangul={vocab.hangul} audioUrl={getVocabularyAudioUrl(vocab.hangul, vocab.audioUrl)} />
                      <span className="text-xs font-mono text-indigo-400">
                        [{vocab.romanization}]
                      </span>
                    </div>
                    <p className="text-xs font-medium text-emerald-300">
                      {vocab.vietnameseMeaning}
                    </p>
                    {vocab.exampleSentenceHangul && (
                      <p className="text-[11px] text-slate-400 italic">
                        Ví dụ: {vocab.exampleSentenceHangul}
                      </p>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </section>
        )}

        {/* Exercises Section Preview */}
        {lesson.exercises.length > 0 && (
          <section className="space-y-4 p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Bài tập trắc nghiệm & củng cố ({lesson.exercises.length} bài)
              </h3>
              <p className="text-xs text-slate-400">
                Hiển thị đề bài và số lượng câu hỏi trong bài tập
              </p>
            </div>

            <div className="space-y-3">
              {lesson.exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-sm">{ex.title}</h4>
                    <span className="text-xs text-indigo-300">
                      {ex.questions.length} câu hỏi
                    </span>
                  </div>
                  {ex.description && (
                    <p className="text-xs text-slate-400">{ex.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
