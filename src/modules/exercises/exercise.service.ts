import { QuestionType } from "@prisma/client";
import { exerciseRepository, ExerciseRepository } from "./exercise.repository";
import {
  gradeExerciseAttempt,
  StudentQuestionAnswerInput,
  ExerciseGradingResult,
} from "./scoring";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/shared/errors/domain-errors";
import { progressService, ProgressService } from "@/modules/progress/progress.service";

export interface SanitizedQuestionOption {
  id: string;
  questionId: string;
  text: string;
  displayOrder: number;
}

export interface SanitizedQuestion {
  id: string;
  exerciseId: string;
  type: QuestionType;
  prompt: string;
  audioUrl: string | null;
  displayOrder: number;
  options: SanitizedQuestionOption[];
}

export interface SanitizedExercise {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  displayOrder: number;
  questions: SanitizedQuestion[];
}

export interface RawOptionWithGrading {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  explanation?: string | null;
  displayOrder: number;
}

export interface RawQuestionWithGrading {
  id: string;
  exerciseId: string;
  type: QuestionType;
  prompt: string;
  audioUrl?: string | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  displayOrder: number;
  options: RawOptionWithGrading[];
}

export interface RawExerciseWithGrading {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  displayOrder: number;
  questions: RawQuestionWithGrading[];
}

/**
 * Pure function that sanitizes an exercise for student-facing payloads.
 * Strips all `isCorrect`, `correctAnswer`, and solution `explanation` fields.
 */
export function sanitizeExerciseForStudent(
  exercise: RawExerciseWithGrading
): SanitizedExercise {
  return {
    id: exercise.id,
    lessonId: exercise.lessonId,
    title: exercise.title,
    description: exercise.description,
    displayOrder: exercise.displayOrder,
    questions: exercise.questions.map((question) => {
      // Intentionally omit correctAnswer and explanation
      const sanitizedQuestion: SanitizedQuestion = {
        id: question.id,
        exerciseId: question.exerciseId,
        type: question.type,
        prompt: question.prompt,
        audioUrl: question.audioUrl ?? null,
        displayOrder: question.displayOrder,
        options: question.options.map((option) => {
          // Intentionally omit isCorrect and explanation
          const sanitizedOption: SanitizedQuestionOption = {
            id: option.id,
            questionId: option.questionId,
            text: option.text,
            displayOrder: option.displayOrder,
          };
          return sanitizedOption;
        }),
      };
      return sanitizedQuestion;
    }),
  };
}

export class ExerciseService {
  constructor(
    private readonly repo: ExerciseRepository = exerciseRepository,
    private readonly progress: ProgressService = progressService
  ) {}

  /**
   * Retrieves an exercise sanitized for student delivery.
   * Guaranteed never to leak correct answer flags or answers.
   */
  async getExerciseForStudent(exerciseId: string): Promise<SanitizedExercise | null> {
    const rawExercise = await this.repo.findExerciseById(exerciseId);
    if (!rawExercise) {
      return null;
    }

    return sanitizeExerciseForStudent(rawExercise);
  }

  /**
   * Retrieves all sanitized exercises for a lesson.
   */
  async getLessonExercisesForStudent(
    lessonId: string
  ): Promise<SanitizedExercise[]> {
    const rawExercises = await this.repo.findExercisesByLessonId(lessonId);
    return rawExercises.map(sanitizeExerciseForStudent);
  }

  /**
   * Submits student answers, executes server-side grading, and saves attempt.
   * Enforces:
   * - only authenticated users
   * - reject submissions for unpublished exercises
   * - duplicate network submissions via idempotencyKey return existing attempt
   * - passing score (>= 80%) triggers lesson completion
   */
  async submitAttempt({
    userId,
    exerciseId,
    answers,
    startedAt,
    idempotencyKey,
  }: {
    userId: string;
    exerciseId: string;
    answers: StudentQuestionAnswerInput[];
    startedAt?: Date;
    idempotencyKey?: string;
  }) {
    if (!userId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để nộp bài tập.");
    }

    // Check for duplicate network submission with idempotencyKey
    if (idempotencyKey) {
      const existing = await this.repo.findAttemptByIdempotencyKey(idempotencyKey);
      if (existing) {
        // Return existing attempt result safely
        return this.getAttemptResultForStudent(existing.id, userId);
      }
    }

    const rawExercise = await this.repo.findExerciseById(exerciseId);
    if (!rawExercise) {
      throw new NotFoundError(
        "Không tìm thấy bài tập hoặc bài tập chưa được công khai."
      );
    }

    // Pure server-side grading
    const gradingResult: ExerciseGradingResult = gradeExerciseAttempt(
      rawExercise,
      answers
    );

    const now = new Date();
    const effectiveStartedAt = startedAt || now;

    // Save attempt transactionally
    const attempt = await this.repo.recordAttemptTransaction({
      userId,
      exerciseId,
      gradingResult,
      rawAnswers: answers,
      startedAt: effectiveStartedAt,
      submittedAt: now,
      idempotencyKey,
    });

    // If passing (score >= 80%), mark lesson completed
    if (gradingResult.isPassing) {
      await this.progress.completeLesson({
        requestingUserId: userId,
        targetUserId: userId,
        lessonId: rawExercise.lessonId,
        score: gradingResult.percentage,
      });
    }

    return {
      attemptId: attempt.id,
      exerciseId,
      totalScore: gradingResult.totalScore,
      maxScore: gradingResult.maxScore,
      percentage: gradingResult.percentage,
      isPassing: gradingResult.isPassing,
      gradedQuestions: gradingResult.gradedQuestions,
      submittedAt: now,
    };
  }

  /**
   * Retrieves attempt results for a student.
   * Users may read only their own attempts.
   */
  async getAttemptResultForStudent(attemptId: string, requestingUserId: string) {
    if (!requestingUserId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để xem kết quả bài tập.");
    }

    const attempt = await this.repo.findAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError("Không tìm thấy lần làm bài tập này.");
    }

    if (attempt.userId !== requestingUserId) {
      throw new ForbiddenError(
        "Bạn không có quyền xem kết quả bài tập của học viên khác."
      );
    }

    return {
      attemptId: attempt.id,
      exerciseId: attempt.exerciseId,
      totalScore: attempt.score,
      maxScore: attempt.maxScore,
      percentage: attempt.percentage,
      isPassing: attempt.isPassing,
      submittedAt: attempt.submittedAt,
      answers: attempt.answers.map((ans) => ({
        questionId: ans.questionId,
        isCorrect: ans.isCorrect,
        score: ans.score,
        prompt: ans.question.prompt,
        type: ans.question.type,
        correctAnswer:
          ans.question.correctAnswer ||
          ans.question.options.find((o) => o.isCorrect)?.text ||
          "",
        explanation:
          ans.question.explanation ||
          ans.question.options.find((o) => o.isCorrect)?.explanation ||
          null,
      })),
    };
  }
}

export const exerciseService = new ExerciseService();
