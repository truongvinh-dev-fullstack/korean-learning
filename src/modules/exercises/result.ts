import { QuestionType } from "@prisma/client";
import type { ExerciseRepository } from "./exercise.repository";
import { gradeQuestion, type QuestionGradingResult } from "./scoring";

/** The same wire DTO is returned for initial submissions and acknowledged retries. */
export interface ExerciseResultDto {
  attemptId: string;
  exerciseId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  gradedQuestions: QuestionGradingResult[];
  submittedAt: string | null;
}

type StoredAttempt = NonNullable<Awaited<ReturnType<ExerciseRepository["findAttemptById"]>>>;

export function serializeExerciseResult(attempt: StoredAttempt): ExerciseResultDto {
  return {
    attemptId: attempt.id,
    exerciseId: attempt.exerciseId,
    totalScore: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    isPassing: attempt.isPassing,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    gradedQuestions: [...attempt.answers]
      .sort((a, b) => a.question.displayOrder - b.question.displayOrder || a.questionId.localeCompare(b.questionId))
      .map((answer) => ({
        ...gradeQuestion(answer.question, {
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId,
          ...(answer.question.type === QuestionType.ARRANGE_SENTENCE
            ? { selectedOptionIds: answer.textAnswer?.split(",") ?? [] }
            : { textAnswer: answer.textAnswer }),
        }),
        // Scores and correctness remain the persisted evaluation, not a new attempt.
        score: answer.score,
        isCorrect: answer.isCorrect,
      })),
  };
}
