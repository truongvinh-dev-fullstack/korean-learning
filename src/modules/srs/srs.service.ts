import { prisma } from "@/shared/db/prisma";
import { ReviewRating, CardState } from "@prisma/client";
import { srsRepository, SrsRepository } from "./srs.repository";
import { calculateNextSchedule } from "./srs-scheduler";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/shared/errors/domain-errors";
import {
  getVietnamDateString,
  getVietnamEndOfDayUtc,
} from "@/shared/utils/date";

export interface DueFlashcardItem {
  id: string;
  vocabularyId: string;
  hangul: string;
  romanization: string;
  vietnameseMeaning: string;
  englishMeaning: string;
  partOfSpeech: string | null;
  audioUrl: string | null;
  exampleSentenceHangul: string | null;
  exampleSentenceVi: string | null;
  lessonTitle: string;
  courseTitle: string;
  state: CardState;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  dueAt: Date;
}

export class SrsService {
  constructor(private readonly repo: SrsRepository = srsRepository) {}

  /**
   * Idempotently enqueues all vocabulary from a completed lesson into the student's review deck.
   * New cards start in NEW state with dueAt = now so they can be studied immediately.
   */
  async enqueueLessonVocabulary(userId: string, lessonId: string): Promise<number> {
    if (!userId || !lessonId) return 0;

    const vocabularies = await prisma.vocabulary.findMany({
      where: { lessonId },
      select: { id: true },
    });

    if (vocabularies.length === 0) {
      return 0;
    }

    const cardsToCreate = vocabularies.map((v) => ({
      userId,
      vocabularyId: v.id,
    }));

    const result = await this.repo.createReviewCards(cardsToCreate);
    return result.count;
  }

  /**
   * Retrieves all flashcards due for a student today, using Asia/Ho_Chi_Minh timezone
   * to determine the cutoff for the user's current study day.
   */
  async getDueCardsForStudent(
    userId: string,
    referenceDate: Date = new Date()
  ): Promise<DueFlashcardItem[]> {
    if (!userId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để truy cập ôn tập từ vựng.");
    }

    // Group cards up to the end of user's local study day (23:59:59.999 +07:00)
    const dueCutoffUtc = getVietnamEndOfDayUtc(referenceDate);
    const cards = await this.repo.findDueCardsForUser(userId, dueCutoffUtc);

    return cards.map((c) => ({
      id: c.id,
      vocabularyId: c.vocabularyId,
      hangul: c.vocabulary.hangul,
      romanization: c.vocabulary.romanization,
      vietnameseMeaning: c.vocabulary.vietnameseMeaning,
      englishMeaning: c.vocabulary.englishMeaning,
      partOfSpeech: c.vocabulary.partOfSpeech,
      audioUrl: c.vocabulary.audioUrl,
      exampleSentenceHangul: c.vocabulary.exampleSentenceHangul,
      exampleSentenceVi: c.vocabulary.exampleSentenceVi,
      lessonTitle: c.vocabulary.lesson.title,
      courseTitle: c.vocabulary.lesson.chapter.course.title,
      state: c.state,
      intervalDays: c.intervalDays,
      easeFactor: c.easeFactor,
      repetitions: c.repetitions,
      dueAt: c.dueAt,
    }));
  }

  /**
   * Returns count of due cards for dashboard and navigation badges.
   */
  async getDueCardCountForStudent(
    userId?: string | null,
    referenceDate: Date = new Date()
  ): Promise<number> {
    if (!userId) return 0;

    const dueCutoffUtc = getVietnamEndOfDayUtc(referenceDate);
    return this.repo.countDueCardsForUser(userId, dueCutoffUtc);
  }

  /**
   * Processes a card rating submission.
   * Enforces:
   * - user authentication
   * - card ownership (users cannot modify another student's cards)
   * - idempotency (duplicate network requests return existing log result)
   * - pure scheduling calculation on server
   * - increments daily study stats for streak
   */
  async submitCardReview({
    userId,
    cardId,
    rating,
    idempotencyKey,
    now = new Date(),
  }: {
    userId: string;
    cardId: string;
    rating: ReviewRating;
    idempotencyKey?: string;
    now?: Date;
  }) {
    if (!userId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để ghi nhận ôn tập.");
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingLog = await this.repo.findReviewLogByIdempotencyKey(
        idempotencyKey
      );
      if (existingLog) {
        return {
          cardId: existingLog.cardId,
          rating: existingLog.rating,
          nextIntervalDays: existingLog.intervalAfter,
          nextEaseFactor: existingLog.easeFactorAfter,
          nextRepetitions: existingLog.repetitionsAfter,
          nextState: existingLog.stateAfter,
          dueAt: existingLog.card.dueAt,
          reviewedAt: existingLog.reviewedAt,
        };
      }
    }

    // 2. Fetch Card and verify existence & ownership
    const card = await this.repo.findCardById(cardId);
    if (!card) {
      throw new NotFoundError("Không tìm thấy thẻ từ vựng này.");
    }

    if (card.userId !== userId) {
      throw new ForbiddenError(
        "Bạn không có quyền chỉnh sửa thẻ ôn tập của học viên khác."
      );
    }

    // 3. Pure server-side scheduling calculation
    const nextSchedule = calculateNextSchedule(card, rating, now);
    const vietnamDate = getVietnamDateString(now);

    // 4. Save transactionally
    const { card: updatedCard, log } = await this.repo.recordReviewTransaction({
      userId,
      cardId,
      rating,
      currentCard: card,
      nextSchedule,
      idempotencyKey,
      now,
      vietnamDate,
    });

    return {
      cardId: updatedCard.id,
      rating: log.rating,
      nextIntervalDays: updatedCard.intervalDays,
      nextEaseFactor: updatedCard.easeFactor,
      nextRepetitions: updatedCard.repetitions,
      nextState: updatedCard.state,
      dueAt: updatedCard.dueAt,
      reviewedAt: log.reviewedAt,
    };
  }

  /**
   * Retrieves summary of review statistics for the student.
   */
  async getReviewSummaryForStudent(
    userId: string,
    referenceDate: Date = new Date()
  ) {
    if (!userId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để xem thông tin ôn tập.");
    }

    const [stats, dueCount] = await Promise.all([
      this.repo.getUserSrsStatistics(userId),
      this.getDueCardCountForStudent(userId, referenceDate),
    ]);

    return {
      totalCards: stats.totalCards,
      dueTodayCount: dueCount,
      byState: stats.byState,
      nextDueAt: stats.nextDueAt,
    };
  }
}

export const srsService = new SrsService();
