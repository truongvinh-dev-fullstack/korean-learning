import { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/shared/auth/session";
import { srsService } from "@/modules/srs/srs.service";
import { FlashcardRunner } from "@/components/srs/flashcard-runner";

export const metadata: Metadata = {
  title: "Ôn tập từ vựng Spaced Repetition (SRS) - Korean Zero",
  description:
    "Hệ thống flashcard lặp lại ngắt quãng (SM-2) củng cố trí nhớ dài hạn các từ vựng tiếng Hàn đã học.",
};

export default async function OnTapPage() {
  const session = await requireStudent("/on-tap");
  const user = session.user;

  const [dueCards, summary] = await Promise.all([
    srsService.getDueCardsForStudent(user.id),
    srsService.getReviewSummaryForStudent(user.id),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="space-y-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">
              Trang chủ
            </Link>
            <span>/</span>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Bảng học tập
            </Link>
            <span>/</span>
            <span className="text-slate-200 font-medium">Ôn tập thẻ từ vựng</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ôn tập từ vựng (SRS)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Thuật toán SuperMemo-2 tối ưu hóa thời điểm ôn tập trước khi bạn kịp quên.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
        >
          <span>← Bảng học tập</span>
        </Link>
      </div>

      {/* Main Flashcard Runner */}
      <FlashcardRunner
        initialCards={dueCards}
        userSrsSummary={summary}
      />
    </div>
  );
}
