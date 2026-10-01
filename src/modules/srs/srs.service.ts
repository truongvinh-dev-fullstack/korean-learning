import { prisma } from "@/shared/db/prisma";
import { ReviewRating, CardState, Prisma } from "@prisma/client";
import { srsRepository, SrsRepository } from "./srs.repository";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/shared/errors/domain-errors";
import { getVietnamDateString } from "@/shared/utils/date";

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

  async enqueueLessonVocabularyInTransaction(userId: string, lessonId: string, tx: Prisma.TransactionClient): Promise<number> {
    const vocabularies = await tx.vocabulary.findMany({ where: { lessonId }, select: { id: true } });
    const result = await this.repo.createReviewCards(vocabularies.map((v) => ({ userId, vocabularyId: v.id })), tx);
    return result.count;
  }

  /**
   * Retrieves only cards due at the current server time.
   */
  async getDueCardsForStudent(
    userId: string,
    referenceDate: Date = new Date()
  ): Promise<DueFlashcardItem[]> {
    if (!userId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để truy cập ôn tập từ vựng.");
    }

    const cards = await this.repo.findDueCardsForUser(userId, referenceDate);

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

    return this.repo.countDueCardsForUser(userId, referenceDate);
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

    // Verify ownership before considering an idempotency replay.
    const card = await this.repo.findCardById(cardId);
    if (!card) {
      throw new NotFoundError("Không tìm thấy thẻ từ vựng này.");
    }
    if (card.userId !== userId) {
      throw new ForbiddenError("Bạn không có quyền chỉnh sửa thẻ ôn tập của học viên khác.");
    }

    if (idempotencyKey) {
      const existingLog = await this.repo.findReviewLogByIdempotencyKey(
        idempotencyKey
      );
      if (existingLog) {
        if (existingLog.userId !== userId || existingLog.cardId !== cardId) {
          throw new ForbiddenError("Bạn không có quyền truy cập lượt ôn tập này.");
        }
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

    if (card.dueAt > now) {
      throw new ConflictError("Thẻ này chưa đến hạn ôn tập.");
    }
    const vietnamDate = getVietnamDateString(now);

    // Recheck due time and update conditionally inside the transaction.
    const { card: updatedCard, log } = await this.repo.recordReviewTransaction({
      userId,
      cardId,
      rating,
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
