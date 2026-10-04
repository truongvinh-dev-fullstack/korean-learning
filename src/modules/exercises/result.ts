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

function storedSelectedIds(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) return parsed;
  } catch { /* Legacy selections were stored as comma-separated UUIDs. */ }
  return value.split(",");
}

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
          ...(["ARRANGE_SENTENCE", "MULTIPLE_SELECT", "ORDERING"].includes(answer.question.type)
            ? { selectedOptionIds: storedSelectedIds(answer.textAnswer) }
            : { textAnswer: answer.textAnswer }),
        }),
        // Scores and correctness remain the persisted evaluation, not a new attempt.
        score: answer.score,
        isCorrect: answer.isCorrect,
      })),
  };
}
