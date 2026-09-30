import { prisma } from "@/shared/db/prisma";
import { LessonProgressStatus, ContentStatus } from "@prisma/client";

export class ProgressRepository {
  /**
   * Finds a student's progress for a specific lesson.
   */
  async findLessonProgress(userId: string, lessonId: string) {
    return prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });
  }

  /**
   * Starts a lesson progress record idempotently.
   * If already IN_PROGRESS or COMPLETED, leaves the status unchanged.
   */
  async startLessonProgress(userId: string, lessonId: string, startedAt: Date) {
    const existing = await this.findLessonProgress(userId, lessonId);

    if (!existing) {
      return prisma.lessonProgress.create({
        data: {
          userId,
          lessonId,
          status: LessonProgressStatus.IN_PROGRESS,
          startedAt,
        },
      });
    }

    if (existing.status === LessonProgressStatus.NOT_STARTED) {
      return prisma.lessonProgress.update({
        where: { id: existing.id },
        data: {
          status: LessonProgressStatus.IN_PROGRESS,
          startedAt: existing.startedAt || startedAt,
        },
      });
    }

    return existing;
  }

  /**
   * Atomically completes a lesson, updates daily study stats, and updates enrollment completion if eligible.
   */
  async completeLessonTransaction({
    userId,
    lessonId,
    courseId,
    score,
    now,
    vietnamDate,
  }: {
    userId: string;
    lessonId: string;
    courseId: string;
    score: number;
    now: Date;
    vietnamDate: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Upsert LessonProgress
      const progress = await tx.lessonProgress.upsert({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
        create: {
          userId,
          lessonId,
          status: LessonProgressStatus.COMPLETED,
          score,
          startedAt: now,
          completedAt: now,
        },
        update: {
          status: LessonProgressStatus.COMPLETED,
          score,
          completedAt: now,
        },
      });

      // 2. Upsert DailyStudyStat for Vietnam calendar date
      await tx.dailyStudyStat.upsert({
        where: {
          userId_date: {
            userId,
            date: vietnamDate,
          },
        },
        create: {
          userId,
          date: vietnamDate,
          lessonsCompleted: 1,
        },
        update: {
          lessonsCompleted: { increment: 1 },
        },
      });

      // 3. Check if all course lessons are completed
      const totalPublishedLessons = await tx.lesson.count({
        where: {
          status: ContentStatus.PUBLISHED,
          chapter: {
            courseId,
            status: ContentStatus.PUBLISHED,
          },
        },
      });

      const completedLessons = await tx.lessonProgress.count({
        where: {
          userId,
          status: LessonProgressStatus.COMPLETED,
          lesson: {
            status: ContentStatus.PUBLISHED,
            chapter: {
              courseId,
              status: ContentStatus.PUBLISHED,
            },
          },
        },
      });

      if (totalPublishedLessons > 0 && completedLessons >= totalPublishedLessons) {
        await tx.enrollment.updateMany({
          where: {
            userId,
            courseId,
            completedAt: null,
          },
          data: {
            completedAt: now,
          },
        });
      }

      return progress;
    });
  }

  /**
   * Retrieves all completed lesson progresses for a user across a course.
   */
  async findUserProgressForCourse(userId: string, courseId: string) {
    return prisma.lessonProgress.findMany({
      where: {
        userId,
        lesson: {
          status: ContentStatus.PUBLISHED,
          chapter: {
            courseId,
            status: ContentStatus.PUBLISHED,
          },
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            slug: true,
            title: true,
            displayOrder: true,
            chapter: {
              select: {
                id: true,
                title: true,
                displayOrder: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Retrieves all daily activity records for streak calculation.
   */
  async findUserDailyStudyStats(userId: string) {
    return prisma.dailyStudyStat.findMany({
      where: {
        userId,
        lessonsCompleted: { gt: 0 },
      },
      orderBy: {
        date: "desc",
      },
    });
  }

  /**
   * Counts total completed lessons for a user.
   */
  async countCompletedLessons(userId: string) {
    return prisma.lessonProgress.count({
      where: {
        userId,
        status: LessonProgressStatus.COMPLETED,
        lesson: {
          status: ContentStatus.PUBLISHED,
        },
      },
    });
  }
}

export const progressRepository = new ProgressRepository();
