import { prisma } from "@/shared/db/prisma";
import { ContentStatus } from "@prisma/client";
import { RawExerciseWithGrading } from "./exercise.service";
import { ExerciseGradingResult, StudentQuestionAnswerInput } from "./scoring";
import { withSerializableRetry } from "@/shared/db/serializable-transaction";
import { ConflictError } from "@/shared/errors/domain-errors";

export class ExerciseRepository {
  /**
   * Finds an exercise by ID with questions and options.
   */
  async findExerciseById(id: string): Promise<RawExerciseWithGrading | null> {
    return prisma.exercise.findFirst({
      where: {
        id,
        status: ContentStatus.PUBLISHED,
        lesson: { status: ContentStatus.PUBLISHED, chapter: { status: ContentStatus.PUBLISHED, course: { status: ContentStatus.PUBLISHED } } },
      },
      include: {
        questions: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          include: {
            options: {
              orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
            },
          },
        },
      },
    });
  }

  /**
   * Finds all exercises for a lesson.
   */
  async findExercisesByLessonId(lessonId: string): Promise<RawExerciseWithGrading[]> {
    return prisma.exercise.findMany({
      where: {
        lessonId,
        status: ContentStatus.PUBLISHED,
        lesson: { status: ContentStatus.PUBLISHED, chapter: { status: ContentStatus.PUBLISHED, course: { status: ContentStatus.PUBLISHED } } },
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: {
        questions: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          include: {
            options: {
              orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
            },
          },
        },
      },
    });
  }

  /**
   * Finds an attempt by idempotency key.
   */
  async findAttemptByIdempotencyKey(idempotencyKey: string) {
    return prisma.exerciseAttempt.findUnique({
      where: { idempotencyKey },
      include: {
        answers: true,
      },
    });
  }

  /**
   * Finds an attempt by ID.
   */
  async findAttemptById(id: string) {
    return prisma.exerciseAttempt.findUnique({
      where: { id },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
        exercise: true,
      },
    });
  }

  /**
   * Finds all attempts by a user for a specific exercise.
   */
  async findUserAttemptsForExercise(userId: string, exerciseId: string) {
    return prisma.exerciseAttempt.findMany({
      where: {
        userId,
        exerciseId,
      },
      orderBy: {
        submittedAt: "desc",
      },
      include: {
        answers: true,
      },
    });
  }

  /**
   * Persists an exercise attempt and all question answers in a database transaction.
   */
  async recordAttemptTransaction({
    userId,
    exerciseId,
    gradingResult,
    rawAnswers,
    startedAt,
    submittedAt,
    idempotencyKey,
    questionVersions,
  }: {
    userId: string;
    exerciseId: string;
    gradingResult: ExerciseGradingResult;
    rawAnswers: StudentQuestionAnswerInput[];
    startedAt: Date;
    submittedAt: Date;
    idempotencyKey?: string;
    questionVersions?: { id: string; updatedAt: Date }[];
  }) {
    return withSerializableRetry(async (tx) => {
      if (questionVersions?.length) {
        const current = await tx.question.findMany({ where: { exerciseId }, select: { id: true, updatedAt: true } });
        if (current.length !== questionVersions.length || current.some((question) =>
          !questionVersions.some((version) => version.id === question.id && version.updatedAt.getTime() === question.updatedAt.getTime()))) {
          throw new ConflictError("Nội dung bài tập vừa thay đổi. Tải lại bài tập trước khi nộp.");
        }
      }
      // 1. Create ExerciseAttempt
      const attempt = await tx.exerciseAttempt.create({
        data: {
          idempotencyKey: idempotencyKey || null,
          userId,
          exerciseId,
          startedAt,
          submittedAt,
          score: gradingResult.totalScore,
          maxScore: gradingResult.maxScore,
          percentage: gradingResult.percentage,
          isPassing: gradingResult.isPassing,
        },
      });

      // Map raw inputs by question ID
      const rawAnswerMap = new Map(rawAnswers.map((a) => [a.questionId, a]));

      // 2. Create AttemptAnswer for each question
      for (const graded of gradingResult.gradedQuestions) {
        const rawAns = rawAnswerMap.get(graded.questionId);
        await tx.attemptAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: graded.questionId,
            selectedOptionId: rawAns?.selectedOptionId || null,
            textAnswer:
              rawAns?.textAnswer ||
              (rawAns?.selectedOptionIds ? graded.type === "ARRANGE_SENTENCE" ? rawAns.selectedOptionIds.join(",") : JSON.stringify(rawAns.selectedOptionIds) : null),
            isCorrect: graded.isCorrect,
            score: graded.score,
          },
        });
      }

      return attempt;
    });
  }
}

export const exerciseRepository = new ExerciseRepository();
