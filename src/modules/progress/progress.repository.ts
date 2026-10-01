import { prisma } from "@/shared/db/prisma";
import { LessonProgressStatus, ContentStatus, Prisma } from "@prisma/client";

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

  async findPublishedExerciseIds(lessonId: string) {
    const exercises = await prisma.exercise.findMany({
      where: { lessonId, status: ContentStatus.PUBLISHED },
      select: { id: true },
    });
    return exercises.map((exercise) => exercise.id);
  }

  async findBestPassingAttempt(userId: string, exerciseIds: string[]) {
    return prisma.exerciseAttempt.findFirst({
      where: { userId, exerciseId: { in: exerciseIds }, isPassing: true, submittedAt: { not: null } },
      orderBy: { percentage: "desc" },
      select: { percentage: true },
    });
  }

  /**
   * Starts a lesson progress record idempotently.
   * If already IN_PROGRESS or COMPLETED, leaves the status unchanged.
   */
  async startLessonProgress(userId: string, lessonId: string, startedAt: Date) {
    await prisma.lessonProgress.createMany({
      data: [{ userId, lessonId, status: LessonProgressStatus.IN_PROGRESS, startedAt }],
      skipDuplicates: true,
    });
    await prisma.lessonProgress.updateMany({
      where: { userId, lessonId, status: LessonProgressStatus.NOT_STARTED },
      data: { status: LessonProgressStatus.IN_PROGRESS, startedAt },
    });
    return prisma.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId } } });
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
    enqueueVocabulary,
  }: {
    userId: string;
    lessonId: string;
    courseId: string;
    score: number;
    now: Date;
    vietnamDate: string;
    enqueueVocabulary: (tx: Prisma.TransactionClient) => Promise<number>;
  }) {
    return prisma.$transaction(async (tx) => {
      // A conditional transition ensures concurrent completions increment stats once.
      const transitioned = await tx.lessonProgress.updateMany({
        where: { userId, lessonId, status: { not: LessonProgressStatus.COMPLETED } },
        data: { status: LessonProgressStatus.COMPLETED, score, completedAt: now },
      });
      let newlyCompleted = transitioned.count === 1;
      if (!newlyCompleted) {
        const inserted = await tx.lessonProgress.createMany({
          data: [{ userId, lessonId, status: LessonProgressStatus.COMPLETED, score, startedAt: now, completedAt: now }],
          skipDuplicates: true,
        });
        newlyCompleted = inserted.count === 1;
      }
      await tx.lessonProgress.updateMany({
        where: { userId, lessonId, status: LessonProgressStatus.COMPLETED, score: { lt: score } },
        data: { score },
      });
      const progress = await tx.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId } } });

      // Card insertion shares the progress transaction, including idempotent retries.
      await enqueueVocabulary(tx);

      if (newlyCompleted) {
        // Daily totals and course completion change only on the first transition.
        await tx.dailyStudyStat.upsert({
          where: { userId_date: { userId, date: vietnamDate } },
          create: { userId, date: vietnamDate, lessonsCompleted: 1 },
          update: { lessonsCompleted: { increment: 1 } },
        });

        const totalPublishedLessons = await tx.lesson.count({
          where: {
            status: ContentStatus.PUBLISHED,
            chapter: { courseId, status: ContentStatus.PUBLISHED },
          },
        });

        const completedLessons = await tx.lessonProgress.count({
          where: {
            userId,
            status: LessonProgressStatus.COMPLETED,
            lesson: {
              status: ContentStatus.PUBLISHED,
              chapter: { courseId, status: ContentStatus.PUBLISHED },
            },
          },
        });

        if (totalPublishedLessons > 0 && completedLessons >= totalPublishedLessons) {
          await tx.enrollment.updateMany({
            where: { userId, courseId, completedAt: null },
            data: { completedAt: now },
          });
        }
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
        OR: [{ lessonsCompleted: { gt: 0 } }, { reviewsCompleted: { gt: 0 } }],
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
