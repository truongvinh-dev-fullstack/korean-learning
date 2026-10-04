import { QuestionType } from "@prisma/client";
import { exerciseRepository, ExerciseRepository } from "./exercise.repository";
import {
  gradeExerciseAttempt,
  StudentQuestionAnswerInput,
  ExerciseGradingResult,
  validateExerciseAnswers,
} from "./scoring";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/shared/errors/domain-errors";
import { progressService, ProgressService } from "@/modules/progress/progress.service";
import { lessonAccessService } from "@/modules/lessons/lesson-access.service";
import { serializeExerciseResult, type ExerciseResultDto } from "./result";
import { parseQuestionContent } from "./question.schema";

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
  content?: StudentQuestionContent;
}

export interface StudentQuestionContent {
  source?: string;
  items?: { id: string; text: string }[];
  leftItems?: { id: string; text: string }[];
  rightItems?: { id: string; text: string }[];
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
  content?: unknown;
  updatedAt?: Date;
}

function shuffleItems<T>(values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  return shuffled;
}

function studentContent(question: RawQuestionWithGrading): StudentQuestionContent | undefined {
  switch (question.type) {
    case "TRANSLATION": return { source: parseQuestionContent(question.type, question.content).source };
    case "ORDERING": return { items: shuffleItems(parseQuestionContent(question.type, question.content).items) };
    case "MATCHING": {
      const content = parseQuestionContent(question.type, question.content);
      return { leftItems: content.pairs.map((pair) => ({ id: pair.leftId, text: pair.left })),
        rightItems: shuffleItems(content.pairs.map((pair) => ({ id: pair.rightId, text: pair.right }))) };
    }
    default: return undefined;
  }
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
      const content = studentContent(question);
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
        ...(content && { content }),
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
  async getExerciseForStudent(exerciseId: string, userId: string): Promise<SanitizedExercise | null> {
    const rawExercise = await this.repo.findExerciseById(exerciseId);
    if (!rawExercise) {
      return null;
    }

    await lessonAccessService.requireAccess(userId, rawExercise.lessonId);

    return sanitizeExerciseForStudent(rawExercise);
  }

  /**
   * Retrieves all sanitized exercises for a lesson.
   */
  async getLessonExercisesForStudent(
    lessonId: string,
    userId: string
  ): Promise<SanitizedExercise[]> {
    await lessonAccessService.requireAccess(userId, lessonId);
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
  }): Promise<ExerciseResultDto> {
    if (!userId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để nộp bài tập.");
    }

    const rawExercise = await this.repo.findExerciseById(exerciseId);
    if (!rawExercise) {
      throw new NotFoundError(
        "Không tìm thấy bài tập hoặc bài tập chưa được công khai."
      );
    }

    await lessonAccessService.requireAccess(userId, rawExercise.lessonId);
    validateExerciseAnswers(rawExercise, answers);

    if (idempotencyKey) {
      const existing = await this.repo.findAttemptByIdempotencyKey(idempotencyKey);
      if (existing) {
        if (existing.userId !== userId || existing.exerciseId !== exerciseId) {
          throw new ForbiddenError("Bạn không có quyền truy cập lần làm bài này.");
        }
        if (existing.isPassing) {
          await this.progress.completeLesson({
            requestingUserId: userId,
            targetUserId: userId,
            lessonId: rawExercise.lessonId,
          });
        }
        return this.getAttemptResultForStudent(existing.id, userId);
      }
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
      questionVersions: rawExercise.questions.flatMap((question) => question.updatedAt ? [{ id: question.id, updatedAt: question.updatedAt }] : []),
    });

    // If passing (score >= 80%), mark lesson completed
    if (gradingResult.isPassing) {
      await this.progress.completeLesson({
        requestingUserId: userId,
        targetUserId: userId,
        lessonId: rawExercise.lessonId,
      });
    }

    return this.getAttemptResultForStudent(attempt.id, userId);
  }

  /**
   * Retrieves attempt results for a student.
   * Users may read only their own attempts.
   */
  async getAttemptResultForStudent(attemptId: string, requestingUserId: string): Promise<ExerciseResultDto> {
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

    return serializeExerciseResult(attempt);
  }
}

export const exerciseService = new ExerciseService();
