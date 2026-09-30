import { prisma } from "@/shared/db/prisma";
import { CardState, ReviewRating } from "@prisma/client";
import { NextCardSchedule, ReviewCardState } from "./srs-scheduler";

export interface CreateReviewCardInput {
  userId: string;
  vocabularyId: string;
}

export interface RecordReviewInput {
  userId: string;
  cardId: string;
  rating: ReviewRating;
  currentCard: ReviewCardState;
  nextSchedule: NextCardSchedule;
  idempotencyKey?: string;
  now: Date;
  vietnamDate: string;
}

export class SrsRepository {
  /**
   * Idempotently creates review cards for a user.
   * Duplicate (userId, vocabularyId) pairs are safely skipped.
   */
  async createReviewCards(cards: CreateReviewCardInput[]) {
    if (cards.length === 0) return { count: 0 };

    return prisma.reviewCard.createMany({
      data: cards.map((c) => ({
        userId: c.userId,
        vocabularyId: c.vocabularyId,
        state: CardState.NEW,
        intervalDays: 0,
        easeFactor: 2.50,
        repetitions: 0,
        lapses: 0,
        dueAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Finds due review cards for a user up to the specified due cutoff timestamp.
   */
  async findDueCardsForUser(userId: string, dueCutoffUtc: Date, limit: number = 50) {
    return prisma.reviewCard.findMany({
      where: {
        userId,
        dueAt: { lte: dueCutoffUtc },
      },
      include: {
        vocabulary: {
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                chapter: {
                  select: {
                    title: true,
                    course: {
                      select: {
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { dueAt: "asc" },
      take: limit,
    });
  }

  /**
   * Counts total due cards for a user.
   */
  async countDueCardsForUser(userId: string, dueCutoffUtc: Date): Promise<number> {
    return prisma.reviewCard.count({
      where: {
        userId,
        dueAt: { lte: dueCutoffUtc },
      },
    });
  }

  /**
   * Finds a specific review card with vocabulary details.
   */
  async findCardById(cardId: string) {
    return prisma.reviewCard.findUnique({
      where: { id: cardId },
      include: {
        vocabulary: true,
      },
    });
  }

  /**
   * Finds review log by idempotencyKey to prevent duplicate submissions.
   */
  async findReviewLogByIdempotencyKey(idempotencyKey: string) {
    return prisma.reviewLog.findUnique({
      where: { idempotencyKey },
      include: {
        card: {
          include: {
            vocabulary: true,
          },
        },
      },
    });
  }

  /**
   * Transactionally records a review, updates card schedule, and increments daily stats.
   */
  async recordReviewTransaction({
    userId,
    cardId,
    rating,
    currentCard,
    nextSchedule,
    idempotencyKey,
    now,
    vietnamDate,
  }: RecordReviewInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Update ReviewCard
      const updatedCard = await tx.reviewCard.update({
        where: { id: cardId },
        data: {
          state: nextSchedule.state,
          intervalDays: nextSchedule.intervalDays,
          easeFactor: nextSchedule.easeFactor,
          repetitions: nextSchedule.repetitions,
          lapses: nextSchedule.lapses,
          dueAt: nextSchedule.dueAt,
          lastReviewedAt: nextSchedule.lastReviewedAt,
        },
        include: {
          vocabulary: true,
        },
      });

      // 2. Create ReviewLog
      const log = await tx.reviewLog.create({
        data: {
          cardId,
          userId,
          rating,
          intervalBefore: currentCard.intervalDays,
          intervalAfter: nextSchedule.intervalDays,
          easeFactorBefore: currentCard.easeFactor,
          easeFactorAfter: nextSchedule.easeFactor,
          repetitionsBefore: currentCard.repetitions,
          repetitionsAfter: nextSchedule.repetitions,
          stateBefore: currentCard.state,
          stateAfter: nextSchedule.state,
          idempotencyKey: idempotencyKey || null,
          reviewedAt: now,
        },
      });

      // 3. Upsert DailyStudyStat to increment reviewsCompleted for today's streak
      await tx.dailyStudyStat.upsert({
        where: {
          userId_date: {
            userId,
            date: vietnamDate,
          },
        },
        update: {
          reviewsCompleted: { increment: 1 },
        },
        create: {
          userId,
          date: vietnamDate,
          reviewsCompleted: 1,
          lessonsCompleted: 0,
        },
      });

      return {
        card: updatedCard,
        log,
      };
    });
  }

  /**
   * Retrieves overall SRS statistics for a user.
   */
  async getUserSrsStatistics(userId: string) {
    const [totalCards, newCount, learningCount, reviewCount, masteredCount, nextDueCard] =
      await Promise.all([
        prisma.reviewCard.count({ where: { userId } }),
        prisma.reviewCard.count({ where: { userId, state: CardState.NEW } }),
        prisma.reviewCard.count({ where: { userId, state: CardState.LEARNING } }),
        prisma.reviewCard.count({ where: { userId, state: CardState.REVIEW } }),
        prisma.reviewCard.count({ where: { userId, state: CardState.MASTERED } }),
        prisma.reviewCard.findFirst({
          where: { userId },
          orderBy: { dueAt: "asc" },
          select: { dueAt: true },
        }),
      ]);

    return {
      totalCards,
      byState: {
        new: newCount,
        learning: learningCount,
        review: reviewCount,
        mastered: masteredCount,
      },
      nextDueAt: nextDueCard?.dueAt || null,
    };
  }
}

export const srsRepository = new SrsRepository();
