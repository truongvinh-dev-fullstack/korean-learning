import "dotenv/config";
import { describe, it, expect } from "vitest";
import {
  sanitizeExerciseForStudent,
  exerciseService,
  RawExerciseWithGrading,
} from "@/modules/exercises/exercise.service";
import { QuestionType } from "@prisma/client";

describe("Exercise Retrieval & Answer Sanitization (Cheat Protection)", () => {
  const mockExerciseWithAnswers: RawExerciseWithGrading = {
    id: "ex-123",
    lessonId: "les-456",
    title: "Bài kiểm tra mẫu",
    description: "Mô tả bài tập",
    displayOrder: 1,
    questions: [
      {
        id: "q-1",
        exerciseId: "ex-123",
        type: QuestionType.MULTIPLE_CHOICE,
        prompt: "Chọn đáp án đúng:",
        correctAnswer: "A",
        explanation: "Đáp án A là chính xác vì...",
        displayOrder: 1,
        options: [
          {
            id: "opt-1",
            questionId: "q-1",
            text: "Đáp án A",
            isCorrect: true,
            explanation: "Giải thích option A",
            displayOrder: 1,
          },
          {
            id: "opt-2",
            questionId: "q-1",
            text: "Đáp án B",
            isCorrect: false,
            explanation: "Giải thích option B",
            displayOrder: 2,
          },
        ],
      },
      {
        id: "q-2",
        exerciseId: "ex-123",
        type: QuestionType.FILL_BLANK,
        prompt: "Điền từ còn thiếu:",
        correctAnswer: "saja",
        explanation: "Từ cần điền là saja",
        displayOrder: 2,
        options: [],
      },
      {
        id: "q-3",
        exerciseId: "ex-123",
        type: QuestionType.ARRANGE_SENTENCE,
        prompt: "Sắp xếp các khối từ:",
        correctAnswer: "Tôi là sinh viên",
        explanation: "Trật tự chuẩn là Chủ ngữ + Vị ngữ",
        displayOrder: 3,
        options: [
          { id: "opt-3", questionId: "q-3", text: "Tôi", isCorrect: false, displayOrder: 1 },
          { id: "opt-4", questionId: "q-3", text: "sinh viên", isCorrect: false, displayOrder: 2 },
          { id: "opt-5", questionId: "q-3", text: "là", isCorrect: false, displayOrder: 3 },
        ],
      },
      {
        id: "q-4",
        exerciseId: "ex-123",
        type: QuestionType.LISTENING_CHOICE,
        prompt: "Nghe và chọn:",
        audioUrl: "/audio/sample.mp3",
        correctAnswer: "Đáp án nghe",
        explanation: "Phát âm là A",
        displayOrder: 4,
        options: [
          { id: "opt-6", questionId: "q-4", text: "Lựa chọn 1", isCorrect: true, displayOrder: 1 },
          { id: "opt-7", questionId: "q-4", text: "Lựa chọn 2", isCorrect: false, displayOrder: 2 },
        ],
      },
    ],
  };

  it("pure sanitizer strictly removes isCorrect from all question options", () => {
    const sanitized = sanitizeExerciseForStudent(mockExerciseWithAnswers);

    for (const question of sanitized.questions) {
      for (const option of question.options) {
        expect(option).not.toHaveProperty("isCorrect");
        expect(Reflect.get(option, "isCorrect")).toBeUndefined();
        expect(option).not.toHaveProperty("explanation");
      }
    }
  });

  it("pure sanitizer strictly removes correctAnswer and explanation from all questions", () => {
    const sanitized = sanitizeExerciseForStudent(mockExerciseWithAnswers);

    for (const question of sanitized.questions) {
      expect(question).not.toHaveProperty("correctAnswer");
      expect(Reflect.get(question, "correctAnswer")).toBeUndefined();
      expect(question).not.toHaveProperty("explanation");
      expect(Reflect.get(question, "explanation")).toBeUndefined();
    }
  });

  it("preserves necessary student-facing question fields and options", () => {
    const sanitized = sanitizeExerciseForStudent(mockExerciseWithAnswers);

    expect(sanitized.id).toBe("ex-123");
    expect(sanitized.title).toBe("Bài kiểm tra mẫu");
    expect(sanitized.questions).toHaveLength(4);

    const q1 = sanitized.questions[0];
    expect(q1.prompt).toBe("Chọn đáp án đúng:");
    expect(q1.options).toHaveLength(2);
    expect(q1.options[0].text).toBe("Đáp án A");
    expect(q1.options[0].id).toBe("opt-1");

    const q4 = sanitized.questions[3];
    expect(q4.type).toBe(QuestionType.LISTENING_CHOICE);
    expect(q4.audioUrl).toBe("/audio/sample.mp3");
  });

  it("retrieves real seeded exercise from database without leaking answers", async () => {
    const exerciseId = "e0000000-0000-4000-a000-000000000001";
    const studentExercise = await exerciseService.getExerciseForStudent(exerciseId);

    expect(studentExercise).not.toBeNull();
    expect(studentExercise?.id).toBe(exerciseId);
    expect(studentExercise?.questions.length).toBeGreaterThan(0);

    for (const q of studentExercise!.questions) {
      // Must NOT leak correct answers or explanations
      expect(q).not.toHaveProperty("correctAnswer");
      expect(Reflect.get(q, "correctAnswer")).toBeUndefined();
      expect(q).not.toHaveProperty("explanation");
      expect(Reflect.get(q, "explanation")).toBeUndefined();

      for (const opt of q.options) {
        expect(opt).not.toHaveProperty("isCorrect");
        expect(Reflect.get(opt, "isCorrect")).toBeUndefined();
      }
    }
  });

  it("retrieves lesson exercises for student without leaking answers across all questions", async () => {
    const lessonId = "l0000000-0000-4000-a000-000000000001";
    const exercises = await exerciseService.getLessonExercisesForStudent(lessonId);

    expect(exercises.length).toBeGreaterThan(0);
    const exercise = exercises[0];

    for (const question of exercise.questions) {
      expect(Reflect.get(question, "correctAnswer")).toBeUndefined();
      for (const opt of question.options) {
        expect(Reflect.get(opt, "isCorrect")).toBeUndefined();
      }
    }
  });
});
