import { QuestionType } from "@prisma/client";
import { RawExerciseWithGrading, RawQuestionWithGrading } from "./exercise.service";

export interface StudentQuestionAnswerInput {
  questionId: string;
  selectedOptionId?: string | null;
  selectedOptionIds?: string[] | null;
  textAnswer?: string | null;
}

export interface QuestionGradingResult {
  questionId: string;
  type: QuestionType;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  studentAnswerDisplay: string;
  correctAnswerDisplay: string;
  explanation: string | null;
}

export interface ExerciseGradingResult {
  exerciseId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  gradedQuestions: QuestionGradingResult[];
}

/**
 * Normalizes a fill-in-the-blank text answer in a documented conservative manner:
 * 1. Safely coerces non-strings / null / undefined to empty string.
 * 2. Normalizes Unicode characters to NFC form so composed and decomposed Hangul glyphs match.
 * 3. Strips non-printable and zero-width characters (e.g. \u200B, \uFEFF).
 * 4. Trims leading and trailing whitespace.
 * 5. Collapses multiple internal whitespace characters into a single space.
 * 6. Case-folds Latin characters for case-insensitive matching while preserving Hangul syllables.
 */
export function normalizeFillBlankAnswer(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // strip zero-width characters
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Pure function that grades a single question against a student's answer.
 * Strictly verifies question ownership and option ownership.
 */
export function gradeQuestion(
  question: RawQuestionWithGrading,
  answerInput?: StudentQuestionAnswerInput
): QuestionGradingResult {
  const maxScore = 10;

  // 1. Missing answer
  if (!answerInput) {
    const correctOpt = question.options.find((o) => o.isCorrect);
    return {
      questionId: question.id,
      type: question.type,
      isCorrect: false,
      score: 0,
      maxScore,
      studentAnswerDisplay: "(Chưa trả lời)",
      correctAnswerDisplay: question.correctAnswer || correctOpt?.text || "",
      explanation: question.explanation || correctOpt?.explanation || null,
    };
  }

  // Question ownership mismatch check
  if (answerInput.questionId !== question.id) {
    throw new Error(
      `Question ID mismatch: expected ${question.id}, got ${answerInput.questionId}`
    );
  }

  switch (question.type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.LISTENING_CHOICE: {
      const selectedOptionId = answerInput.selectedOptionId;
      const correctOption = question.options.find((o) => o.isCorrect);
      const correctAnswerDisplay = correctOption?.text || question.correctAnswer || "";

      if (!selectedOptionId) {
        return {
          questionId: question.id,
          type: question.type,
          isCorrect: false,
          score: 0,
          maxScore,
          studentAnswerDisplay: "(Chưa chọn đáp án)",
          correctAnswerDisplay,
          explanation: question.explanation || correctOption?.explanation || null,
        };
      }

      // Enforce option ownership: option MUST belong to this question
      const chosenOption = question.options.find((o) => o.id === selectedOptionId);
      if (!chosenOption) {
        return {
          questionId: question.id,
          type: question.type,
          isCorrect: false,
          score: 0,
          maxScore,
          studentAnswerDisplay: "(Lựa chọn không hợp lệ)",
          correctAnswerDisplay,
          explanation: question.explanation || correctOption?.explanation || null,
        };
      }

      const isCorrect = Boolean(chosenOption.isCorrect);
      return {
        questionId: question.id,
        type: question.type,
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        studentAnswerDisplay: chosenOption.text,
        correctAnswerDisplay,
        explanation: question.explanation || chosenOption.explanation || correctOption?.explanation || null,
      };
    }

    case QuestionType.FILL_BLANK: {
      const studentNorm = normalizeFillBlankAnswer(answerInput.textAnswer);
      const targetNorm = normalizeFillBlankAnswer(question.correctAnswer);
      const isCorrect = studentNorm.length > 0 && studentNorm === targetNorm;

      return {
        questionId: question.id,
        type: question.type,
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        studentAnswerDisplay: answerInput.textAnswer?.trim() || "(Chưa nhập)",
        correctAnswerDisplay: question.correctAnswer || "",
        explanation: question.explanation || null,
      };
    }

    case QuestionType.ARRANGE_SENTENCE: {
      const correctAnswerDisplay = question.correctAnswer || "";
      const targetNorm = normalizeFillBlankAnswer(question.correctAnswer);

      // Student can submit either ordered option IDs or direct text
      if (answerInput.selectedOptionIds && Array.isArray(answerInput.selectedOptionIds)) {
        const optionIds = answerInput.selectedOptionIds;

        // Check for duplicate option IDs
        const uniqueIds = new Set(optionIds);
        if (uniqueIds.size !== optionIds.length) {
          return {
            questionId: question.id,
            type: question.type,
            isCorrect: false,
            score: 0,
            maxScore,
            studentAnswerDisplay: "(Chứa từ trùng lặp)",
            correctAnswerDisplay,
            explanation: question.explanation || null,
          };
        }

        // Check option ownership: all option IDs must belong to this question
        const optionsMap = new Map(question.options.map((o) => [o.id, o.text]));
        const hasForeignOption = optionIds.some((id) => !optionsMap.has(id));
        if (hasForeignOption) {
          return {
            questionId: question.id,
            type: question.type,
            isCorrect: false,
            score: 0,
            maxScore,
            studentAnswerDisplay: "(Chứa khối từ không hợp lệ)",
            correctAnswerDisplay,
            explanation: question.explanation || null,
          };
        }

        const assembledWords = optionIds.map((id) => optionsMap.get(id)!);
        const assembledSentence = assembledWords.join(" ");
        const studentNorm = normalizeFillBlankAnswer(assembledSentence);

        const isCorrect = studentNorm === targetNorm;
        return {
          questionId: question.id,
          type: question.type,
          isCorrect,
          score: isCorrect ? maxScore : 0,
          maxScore,
          studentAnswerDisplay: assembledSentence,
          correctAnswerDisplay,
          explanation: question.explanation || null,
        };
      }

      // Fallback: evaluate textAnswer
      const studentNorm = normalizeFillBlankAnswer(answerInput.textAnswer);
      const isCorrect = studentNorm.length > 0 && studentNorm === targetNorm;

      return {
        questionId: question.id,
        type: question.type,
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        studentAnswerDisplay: answerInput.textAnswer?.trim() || "(Chưa sắp xếp)",
        correctAnswerDisplay,
        explanation: question.explanation || null,
      };
    }

    default: {
      return {
        questionId: question.id,
        type: question.type,
        isCorrect: false,
        score: 0,
        maxScore,
        studentAnswerDisplay: "(Dạng câu hỏi không hỗ trợ)",
        correctAnswerDisplay: "",
        explanation: null,
      };
    }
  }
}

/**
 * Pure function that evaluates all questions of an exercise against submitted answers.
 * Passing threshold is 80%.
 */
export function gradeExerciseAttempt(
  exercise: RawExerciseWithGrading,
  answers: StudentQuestionAnswerInput[]
): ExerciseGradingResult {
  const answerMap = new Map<string, StudentQuestionAnswerInput>();
  for (const ans of answers) {
    if (ans && ans.questionId) {
      answerMap.set(ans.questionId, ans);
    }
  }

  const gradedQuestions = exercise.questions.map((question) => {
    const studentAns = answerMap.get(question.id);
    return gradeQuestion(question, studentAns);
  });

  const maxScore = gradedQuestions.reduce((sum, g) => sum + g.maxScore, 0);
  const totalScore = gradedQuestions.reduce((sum, g) => sum + g.score, 0);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const isPassing = percentage >= 80;

  return {
    exerciseId: exercise.id,
    totalScore,
    maxScore,
    percentage,
    isPassing,
    gradedQuestions,
  };
}
