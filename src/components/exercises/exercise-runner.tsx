"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SanitizedExercise, SanitizedQuestion } from "@/modules/exercises/exercise.service";
import { QuestionType } from "@prisma/client";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { ExerciseResultDto } from "@/modules/exercises/result";
import { StructuredQuestionInput, isQuestionAnswered } from "./structured-question-input";

export interface ExerciseRunnerProps {
  exercise: SanitizedExercise;
  isAuthenticated: boolean;
  courseSlug: string;
  lessonSlug: string;
  nextLessonSlug?: string | null;
}

interface QuestionAnswerState {
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export function ExerciseRunner({
  exercise,
  isAuthenticated,
  courseSlug,
  lessonSlug,
  nextLessonSlug,
}: ExerciseRunnerProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, QuestionAnswerState>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ExerciseResultDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const questions = exercise.questions;
  const currentQuestion: SanitizedQuestion | undefined = questions[currentIndex];

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] || {} : {};

  // Count answered questions
  const answeredCount = questions.filter((question) => isQuestionAnswered(question, answers[question.id])).length;

  // Handlers for question answer changes
  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOptionId: optionId,
      },
    }));
  };

  const handleTextChange = (text: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        textAnswer: text,
      },
    }));
  };

  const handleArrangeTileClick = (optionId: string) => {
    if (!currentQuestion) return;
    const currentList = currentAnswer.selectedOptionIds || [];
    if (currentList.includes(optionId)) {
      // Remove tile
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          selectedOptionIds: currentList.filter((id) => id !== optionId),
        },
      }));
    } else {
      // Add tile
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          selectedOptionIds: [...currentList, optionId],
        },
      }));
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      router.push(
        `/dang-nhap?callbackUrl=${encodeURIComponent(
          `/courses/${courseSlug}/lessons/${lessonSlug}`
        )}`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setShowConfirmModal(false);

    try {
      const payloadAnswers = questions.map((q) => {
        const a = answers[q.id] || {};
        return {
          questionId: q.id,
          selectedOptionId: a.selectedOptionId || null,
          selectedOptionIds: a.selectedOptionIds || null,
          textAnswer: a.textAnswer || null,
        };
      });

      const res = await fetch(`/api/exercises/${exercise.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: payloadAnswers,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi nộp bài tập.");
      }

      setResult(data.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi nộp bài.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setErrorMessage(null);
    setIdempotencyKey(crypto.randomUUID());
  };

  if (questions.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-sm">
        Bài học này chưa có câu hỏi luyện tập nào.
      </div>
    );
  }

  // RESULT VIEW AFTER SUBMISSION
  if (result) {
    return (
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-8">
        {/* Header Summary Card */}
        <div
          className={`p-6 rounded-2xl border text-center space-y-3 ${
            result.isPassing
              ? "bg-emerald-950/30 border-emerald-800/60"
              : "bg-rose-950/20 border-rose-800/40"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            {result.isPassing ? (
              <span className="text-emerald-300">🎉 ĐẠT YÊU CẦU (≥ 80%)</span>
            ) : (
              <span className="text-rose-300">⚠️ CHƯA ĐẠT (&lt; 80%)</span>
            )}
          </div>

          <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
            {result.percentage}%
          </h3>

          <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            {result.isPassing
              ? "Chúc mừng bạn! Bạn đã hoàn thành xuất sắc bài kiểm tra. Điểm số và tiến độ bài học đã được ghi nhận tự động."
              : "Bạn cần đạt tối thiểu 80% để vượt qua bài tập này. Đừng nản lòng, hãy xem lời giải thích bên dưới và thử lại nhé!"}
          </p>

          <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
            <button
              type="button"
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              🔄 Làm lại bài tập
            </button>

            {result.isPassing && nextLessonSlug && (
              <Link
                href={`/courses/${courseSlug}/lessons/${nextLessonSlug}`}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
              >
                Bài học kế tiếp →
              </Link>
            )}
          </div>
        </div>

        {/* Detailed Question Explanations */}
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-white tracking-tight">
            Chi tiết lời giải & giải thích đáp án
          </h4>

          <div className="space-y-4">
            {result.gradedQuestions.map((q, idx) => {
              const originalQ = questions.find((item) => item.id === q.questionId);

              return (
                <div
                  key={q.questionId}
                  className={`p-5 rounded-2xl border space-y-3 ${
                    q.isCorrect
                      ? "bg-slate-950/80 border-emerald-900/40"
                      : "bg-slate-950/80 border-rose-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400">
                      Câu {idx + 1}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        q.isCorrect
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                          : "bg-rose-950 text-rose-300 border border-rose-800/60"
                      }`}
                    >
                      {q.isCorrect ? "✔ Chính xác (+10 điểm)" : "✖ Sai (0 điểm)"}
                    </span>
                  </div>

                  {originalQ && (
                    <p className="text-sm font-semibold text-white">
                      {originalQ.prompt}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block mb-0.5">Câu trả lời của bạn:</span>
                      <span
                        className={`font-semibold ${
                          q.isCorrect ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {q.studentAnswerDisplay}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block mb-0.5">Đáp án chính xác:</span>
                      <span className="font-semibold text-emerald-300">
                        {q.correctAnswerDisplay}
                      </span>
                    </div>
                  </div>

                  {q.explanation && (
                    <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-xs text-slate-300 leading-relaxed">
                      <span className="font-bold text-indigo-300">💡 Giải thích: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE QUIZ RUNNER VIEW
  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-2xl space-y-6 relative">
      {/* Quiz Header & Progress Indicator */}
      <div className="space-y-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Bài tập tương tác
            </span>
            <h3 className="text-xl font-bold text-white mt-0.5">{exercise.title}</h3>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Đã làm: {answeredCount} / {questions.length} câu
          </span>
        </div>

        <ProgressBar
          value={currentIndex + 1}
          max={questions.length}
          label={`Câu hỏi ${currentIndex + 1} / ${questions.length}`}
          showPercentage
          size="sm"
          variant="indigo"
        />
      </div>

      {/* Current Question Body */}
      {currentQuestion && (
        <div className="space-y-6 min-h-[220px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-300 text-xs font-bold flex items-center justify-center">
                {currentIndex + 1}
              </span>
              <h4 className="text-base sm:text-lg font-bold text-white">
                {currentQuestion.prompt}
              </h4>
            </div>

            {currentQuestion.audioUrl && (
              <div className="pt-2">
                <audio controls className="h-8 max-w-sm" src={currentQuestion.audioUrl}>
                  Trình duyệt không hỗ trợ phát âm thanh.
                </audio>
              </div>
            )}
          </div>

          {/* 1. MULTIPLE_CHOICE or LISTENING_CHOICE */}
          <StructuredQuestionInput question={currentQuestion} answer={currentAnswer} onChange={(answer) => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: answer }))} />
          {(currentQuestion.type === QuestionType.MULTIPLE_CHOICE ||
            currentQuestion.type === QuestionType.LISTENING_CHOICE) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {currentQuestion.options.map((opt) => {
                const isSelected = currentAnswer.selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.id)}
                    className={`p-4 rounded-2xl text-left border transition-all flex items-center justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                      isSelected
                        ? "bg-indigo-600/20 border-indigo-500 text-white font-bold shadow-md shadow-indigo-600/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    <span className="text-sm sm:text-base">{opt.text}</span>
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                        isSelected
                          ? "border-indigo-400 bg-indigo-600 text-white"
                          : "border-slate-700 bg-slate-900"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. FILL_BLANK */}
          {currentQuestion.type === QuestionType.FILL_BLANK && (
            <div className="space-y-3 pt-2 max-w-md">
              <label
                htmlFor={`input-${currentQuestion.id}`}
                className="block text-xs font-semibold text-slate-400"
              >
                Nhập câu trả lời của bạn:
              </label>
              <input
                id={`input-${currentQuestion.id}`}
                type="text"
                value={currentAnswer.textAnswer || ""}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Nhập chữ cái / từ còn thiếu..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm outline-none transition-all font-mono"
              />
            </div>
          )}

          {/* 3. ARRANGE_SENTENCE */}
          {currentQuestion.type === QuestionType.ARRANGE_SENTENCE && (
            <div className="space-y-4 pt-2">
              <span className="text-xs text-slate-400 block">
                Nhấp vào các từ để sắp xếp theo thứ tự chuẩn:
              </span>

              {/* Assembled sentence area */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 min-h-[56px] flex items-center flex-wrap gap-2">
                {(currentAnswer.selectedOptionIds || []).length === 0 ? (
                  <span className="text-xs text-slate-500 italic">
                    (Chưa chọn từ nào. Nhấp các khối từ bên dưới để ghép câu)
                  </span>
                ) : (
                  (currentAnswer.selectedOptionIds || []).map((optId) => {
                    const opt = currentQuestion.options.find((o) => o.id === optId);
                    return (
                      <button
                        key={optId}
                        type="button"
                        onClick={() => handleArrangeTileClick(optId)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-rose-600 transition-colors shadow-sm cursor-pointer"
                        title="Nhấp để gỡ từ này"
                      >
                        {opt?.text} ×
                      </button>
                    );
                  })
                )}
              </div>

              {/* Word tiles bank */}
              <div className="flex items-center flex-wrap gap-2 pt-2">
                {currentQuestion.options.map((opt) => {
                  const isUsed = (currentAnswer.selectedOptionIds || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isUsed}
                      onClick={() => handleArrangeTileClick(opt.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                        isUsed
                          ? "opacity-30 border-dashed border-slate-800 bg-transparent text-slate-600 cursor-not-allowed"
                          : "bg-slate-900 border-slate-700 text-white hover:border-indigo-500 hover:bg-slate-800"
                      }`}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls */}
      <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors cursor-pointer"
        >
          ← Câu trước
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-xs">
          {questions.map((q, idx) => {
            const isAnswered = isQuestionAnswered(q, answers[q.id]);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                    : isAnswered
                    ? "bg-slate-800 text-indigo-300 border border-indigo-900"
                    : "bg-slate-950 text-slate-500 border border-slate-800"
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Câu tiếp →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
          >
            Nộp bài tập
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center text-xl mx-auto">
              📝
            </div>
            <h4 className="text-lg font-bold text-white">Xác nhận nộp bài</h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Bạn đã trả lời <strong>{answeredCount}</strong> trên tổng số{" "}
              <strong>{questions.length}</strong> câu hỏi. Bạn có chắc muốn nộp bài để hệ thống chấm điểm ngay bây giờ không?
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30"
              >
                {isSubmitting ? "Đang chấm điểm..." : "Nộp bài ngay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
