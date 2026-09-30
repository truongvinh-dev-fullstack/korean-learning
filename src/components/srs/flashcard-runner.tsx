"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ReviewRating, CardState } from "@prisma/client";
import { DueFlashcardItem } from "@/modules/srs/srs.service";
import { ProgressBar } from "@/components/ui/progress-bar";

export interface FlashcardRunnerProps {
  initialCards: DueFlashcardItem[];
  userSrsSummary?: {
    totalCards: number;
    dueTodayCount: number;
    byState: {
      new: number;
      learning: number;
      review: number;
      mastered: number;
    };
    nextDueAt: Date | string | null;
  };
}

export function FlashcardRunner({
  initialCards,
  userSrsSummary,
}: FlashcardRunnerProps) {
  const [cards] = useState<DueFlashcardItem[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showRomanization, setShowRomanization] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const currentCard: DueFlashcardItem | undefined = cards[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handlePlayAudio = () => {
    if (!currentCard?.audioUrl) return;
    try {
      setIsPlayingAudio(true);
      const audio = new Audio(currentCard.audioUrl);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play().catch(() => setIsPlayingAudio(false));
    } catch {
      setIsPlayingAudio(false);
    }
  };

  const handleRate = useCallback(
    async (rating: ReviewRating) => {
      if (!currentCard || isSubmitting) return;

      setIsSubmitting(true);
      setErrorMessage(null);

      const idempotencyKey = crypto.randomUUID();

      try {
        const res = await fetch("/api/srs/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId: currentCard.id,
            rating,
            idempotencyKey,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Lỗi khi lưu kết quả ôn tập.");
        }

        setReviewedCount((prev) => prev + 1);

        // Advance to next card or finish session
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((prev) => prev + 1);
          setIsFlipped(false);
          setShowRomanization(false);
        } else {
          setIsFinished(true);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi kết nối.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentCard, isSubmitting, currentIndex, cards.length]
  );

  // Keyboard Shortcuts: Space/Enter to flip, 1-4 for ratings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleFlip();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleFlip();
        return;
      }

      if (isFlipped && !isSubmitting) {
        if (e.key === "1") {
          e.preventDefault();
          handleRate(ReviewRating.AGAIN);
        } else if (e.key === "2") {
          e.preventDefault();
          handleRate(ReviewRating.HARD);
        } else if (e.key === "3") {
          e.preventDefault();
          handleRate(ReviewRating.GOOD);
        } else if (e.key === "4") {
          e.preventDefault();
          handleRate(ReviewRating.EASY);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleRate, isFlipped, isSubmitting]);

  // EMPTY STATE: No cards due today
  if (cards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/90 border border-slate-800 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-900/20">
            🎉
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Không có thẻ nào cần ôn tập hôm nay!
            </h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Tất cả từ vựng bạn đã học hiện đang trong chu kỳ ghi nhớ tối ưu. Hãy tiếp tục học bài mới để nạp thêm từ vựng vào hàng đợi SRS nhé!
            </p>
          </div>

          {userSrsSummary && userSrsSummary.totalCards > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-400 block">Tổng thẻ:</span>
                <span className="text-base font-bold text-white">
                  {userSrsSummary.totalCards}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Đang học:</span>
                <span className="text-base font-bold text-amber-300">
                  {userSrsSummary.byState.learning}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Đang ôn:</span>
                <span className="text-base font-bold text-indigo-300">
                  {userSrsSummary.byState.review}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Đã thuộc:</span>
                <span className="text-base font-bold text-emerald-300">
                  {userSrsSummary.byState.mastered}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              ← Về Bảng học tập
            </Link>
            <Link
              href="/courses"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              Học bài mới →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // COMPLETION STATE: Finished all cards in this session
  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/90 border border-emerald-900/40 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-950 text-emerald-300 border border-emerald-800/80 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-600/20 animate-bounce">
            🌟
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase tracking-wider">
              Hoàn thành phiên ôn tập
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2">
              Xuất sắc! Bạn đã ôn tập xong {reviewedCount} thẻ!
            </h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Thuật toán lặp lại ngắt quãng (SM-2) đã tự động dời lịch các từ vựng này vào tương lai để củng cố trí nhớ dài hạn của bạn.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
            <p>
              📅 <strong className="text-white">Chuỗi ngày học:</strong> Tiến độ ôn tập hôm nay đã được ghi nhận vào chuỗi Streak của bạn!
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              Về Bảng học tập cá nhân →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE FLASHCARD REVIEW INTERACTION
  return (
    <div className="max-w-xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Session Progress Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-white">
            Thẻ {currentIndex + 1} / {cards.length}
          </span>
          <span>Đã ôn: {reviewedCount} thẻ</span>
        </div>
        <ProgressBar
          value={currentIndex + 1}
          max={cards.length}
          size="sm"
          variant="indigo"
        />
      </div>

      {/* Main Flashcard Container */}
      {currentCard && (
        <div
          role="region"
          aria-label={`Thẻ từ vựng: ${currentCard.hangul}`}
          onClick={handleFlip}
          className={`relative min-h-[360px] p-6 sm:p-8 rounded-3xl border transition-all cursor-pointer select-none shadow-2xl flex flex-col justify-between ${
            isFlipped
              ? "bg-slate-900 border-indigo-500/50 shadow-indigo-500/10"
              : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
          }`}
        >
          {/* Card Top Pill Bar */}
          <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/80">
              {currentCard.lessonTitle}
            </span>

            <div className="flex items-center gap-2">
              {currentCard.partOfSpeech && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950/70 text-indigo-300 border border-indigo-800/40">
                  {currentCard.partOfSpeech}
                </span>
              )}

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  currentCard.state === CardState.NEW
                    ? "bg-sky-950 text-sky-300 border border-sky-800/50"
                    : currentCard.state === CardState.LEARNING
                    ? "bg-amber-950 text-amber-300 border border-amber-800/50"
                    : currentCard.state === CardState.MASTERED
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                    : "bg-purple-950 text-purple-300 border border-purple-800/50"
                }`}
              >
                {currentCard.state === CardState.NEW
                  ? "Từ mới"
                  : currentCard.state === CardState.LEARNING
                  ? "Đang học"
                  : currentCard.state === CardState.MASTERED
                  ? "Đã thuộc"
                  : "Ôn tập"}
              </span>
            </div>
          </div>

          {/* FRONT OF CARD: Korean Hangul & Audio */}
          <div className="my-auto py-6 text-center space-y-4">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
              {currentCard.hangul}
            </h2>

            {/* Pronunciation & Audio */}
            <div className="flex items-center justify-center gap-3">
              {showRomanization ? (
                <span className="text-sm font-mono text-indigo-400">
                  [{currentCard.romanization}]
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRomanization(true);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 cursor-pointer"
                >
                  Xem phiên âm
                </button>
              )}

              {currentCard.audioUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayAudio();
                  }}
                  className={`p-2 rounded-xl text-xs border transition-colors cursor-pointer ${
                    isPlayingAudio
                      ? "bg-indigo-600 text-white border-indigo-500 animate-pulse"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                  }`}
                  title="Nghe phát âm"
                >
                  🔊 Nghe
                </button>
              )}
            </div>

            {/* BACK OF CARD: Vietnamese Meaning & Example */}
            {isFlipped && (
              <div className="pt-6 border-t border-slate-800/80 space-y-3 animate-fadeIn">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">Nghĩa tiếng Việt:</span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
                    {currentCard.vietnameseMeaning}
                  </p>
                  {currentCard.englishMeaning && (
                    <p className="text-xs text-slate-400 font-medium">
                      ({currentCard.englishMeaning})
                    </p>
                  )}
                </div>

                {currentCard.exampleSentenceHangul && (
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-left space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Ví dụ minh họa:
                    </span>
                    <p className="font-semibold text-slate-200">
                      {currentCard.exampleSentenceHangul}
                    </p>
                    {currentCard.exampleSentenceVi && (
                      <p className="text-slate-400">
                        {currentCard.exampleSentenceVi}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card Bottom Hint */}
          <div className="pt-4 border-t border-slate-800/60 text-center">
            <span className="text-xs text-slate-400 font-medium">
              {isFlipped
                ? "💡 Đánh giá độ khó bên dưới để xếp lịch ôn tập"
                : "👆 Nhấp vào thẻ hoặc nhấn [Phím Cách] để xem nghĩa"}
            </span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* RESULT / RATING CONTROLS (Only active when card is flipped) */}
      {isFlipped ? (
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold text-slate-400 block text-center uppercase tracking-wider">
            Bạn nhớ từ này như thế nào?
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1: AGAIN */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRate(ReviewRating.AGAIN)}
              className="p-3 rounded-2xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-800/50 hover:border-rose-700 text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-rose-300 group-hover:text-rose-200">
                  Lại
                </span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded">
                  1
                </kbd>
              </div>
              <span className="text-[11px] text-slate-400 block">Quên / Ôn lại</span>
              <span className="text-[10px] text-rose-400 font-semibold block mt-0.5">
                (1 ngày)
              </span>
            </button>

            {/* 2: HARD */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRate(ReviewRating.HARD)}
              className="p-3 rounded-2xl bg-amber-950/30 hover:bg-amber-950/60 border border-amber-800/50 hover:border-amber-700 text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                  Khó
                </span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded">
                  2
                </kbd>
              </div>
              <span className="text-[11px] text-slate-400 block">Nhớ chật vật</span>
              <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
                (1-3 ngày)
              </span>
            </button>

            {/* 3: GOOD */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRate(ReviewRating.GOOD)}
              className="p-3 rounded-2xl bg-indigo-950/30 hover:bg-indigo-950/60 border border-indigo-800/50 hover:border-indigo-700 text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200">
                  Tốt
                </span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded">
                  3
                </kbd>
              </div>
              <span className="text-[11px] text-slate-400 block">Nhớ chuẩn</span>
              <span className="text-[10px] text-indigo-400 font-semibold block mt-0.5">
                (3-5 ngày)
              </span>
            </button>

            {/* 4: EASY */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleRate(ReviewRating.EASY)}
              className="p-3 rounded-2xl bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-800/50 hover:border-emerald-700 text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
                  Dễ
                </span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded">
                  4
                </kbd>
              </div>
              <span className="text-[11px] text-slate-400 block">Quá quen thuộc</span>
              <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                (7+ ngày)
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleFlip}
            className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            Lật thẻ / Xem đáp án [Phím Cách]
          </button>
        </div>
      )}
    </div>
  );
}
