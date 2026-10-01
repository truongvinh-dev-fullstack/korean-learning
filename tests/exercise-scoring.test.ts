import "dotenv/config";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { QuestionType, LessonProgressStatus } from "@prisma/client";
import {
  normalizeFillBlankAnswer,
  gradeQuestion,
  gradeExerciseAttempt,
  StudentQuestionAnswerInput,
} from "@/modules/exercises/scoring";
import {
  exerciseService,
  RawExerciseWithGrading,
  RawQuestionWithGrading,
} from "@/modules/exercises/exercise.service";
import { prisma } from "@/shared/db/prisma";
import { ForbiddenError, NotFoundError } from "@/shared/errors/domain-errors";

describe("Exercise Scoring Engine (Pure Functions)", () => {
  describe("normalizeFillBlankAnswer", () => {
    it("normalizes Unicode NFD to NFC for Korean Hangul text", () => {
      // '한글' in NFD (decomposed jamo: ㅎ, ㅏ, ㄴ, ㄱ, ㅡ, ㄹ) vs NFC (precomposed syllables)
      const nfdHangul = "한글".normalize("NFD");
      const nfcHangul = "한글".normalize("NFC");

      expect(nfdHangul).not.toBe(nfcHangul); // confirm they have different code points in NFD
      expect(normalizeFillBlankAnswer(nfdHangul)).toBe("한글");
      expect(normalizeFillBlankAnswer(nfcHangul)).toBe("한글");
      expect(normalizeFillBlankAnswer(nfdHangul)).toBe(normalizeFillBlankAnswer(nfcHangul));
    });

    it("strips zero-width spaces and non-printable format characters", () => {
      const textWithZeroWidth = "안녕\u200B하\uFEFF세요\u200C";
      expect(normalizeFillBlankAnswer(textWithZeroWidth)).toBe("안녕하세요");
    });

    it("trims and collapses redundant whitespace", () => {
      const messyWhitespace = "   감사   합니다 \t \n  ";
      expect(normalizeFillBlankAnswer(messyWhitespace)).toBe("감사 합니다");
    });

    it("normalizes case for Latin characters while preserving Korean", () => {
      expect(normalizeFillBlankAnswer(" AnNyeong ")).toBe("annyeong");
      expect(normalizeFillBlankAnswer("KOREA 123")).toBe("korea 123");
    });

    it("handles null, undefined, numbers or non-string inputs safely without crashing", () => {
      expect(normalizeFillBlankAnswer("")).toBe("");
      expect(normalizeFillBlankAnswer("   ")).toBe("");
      expect(normalizeFillBlankAnswer(null)).toBe("");
      expect(normalizeFillBlankAnswer(undefined)).toBe("");
      expect(normalizeFillBlankAnswer(12345)).toBe("");
      expect(normalizeFillBlankAnswer({ text: "hello" })).toBe("");
    });
  });

  describe("gradeQuestion - MULTIPLE_CHOICE", () => {
    const question: RawQuestionWithGrading = {
      id: "q-mc",
      exerciseId: "ex-1",
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: "Chọn từ đúng cho 'xin chào':",
      displayOrder: 1,
      options: [
        { id: "opt-1", questionId: "q-mc", text: "안녕하세요", isCorrect: true, displayOrder: 1 },
        { id: "opt-2", questionId: "q-mc", text: "감사합니다", isCorrect: false, displayOrder: 2 },
      ],
    };

    it("awards full points for the correct option", () => {
      const res = gradeQuestion(question, { questionId: "q-mc", selectedOptionId: "opt-1" });
      expect(res.isCorrect).toBe(true);
      expect(res.score).toBe(10);
      expect(res.maxScore).toBe(10);
      expect(res.studentAnswerDisplay).toBe("안녕하세요");
    });

    it("awards 0 points for an incorrect option", () => {
      const res = gradeQuestion(question, { questionId: "q-mc", selectedOptionId: "opt-2" });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
      expect(res.studentAnswerDisplay).toBe("감사합니다");
    });

    it("awards 0 points for missing answer", () => {
      const res = gradeQuestion(question, undefined);
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
      expect(res.studentAnswerDisplay).toBe("(Chưa trả lời)");
    });

    it("rejects foreign option ID (ownership validation)", () => {
      const res = gradeQuestion(question, { questionId: "q-mc", selectedOptionId: "foreign-opt-999" });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
      expect(res.studentAnswerDisplay).toBe("(Lựa chọn không hợp lệ)");
    });

    it("throws error if questionId does not match question", () => {
      expect(() => {
        gradeQuestion(question, { questionId: "wrong-q-id", selectedOptionId: "opt-1" });
      }).toThrow(/Question ID mismatch/);
    });
  });

  describe("gradeQuestion - FILL_BLANK", () => {
    const question: RawQuestionWithGrading = {
      id: "q-fb",
      exerciseId: "ex-1",
      type: QuestionType.FILL_BLANK,
      prompt: "Điền từ:",
      correctAnswer: "감사합니다",
      displayOrder: 2,
      options: [],
    };

    it("awards full points for exact match", () => {
      const res = gradeQuestion(question, { questionId: "q-fb", textAnswer: "감사합니다" });
      expect(res.isCorrect).toBe(true);
      expect(res.score).toBe(10);
    });

    it("awards full points for normalized NFD input with spaces and zero-width chars", () => {
      const nfdAnswer = "  감사\u200B합니다   ".normalize("NFD");
      const res = gradeQuestion(question, { questionId: "q-fb", textAnswer: nfdAnswer });
      expect(res.isCorrect).toBe(true);
      expect(res.score).toBe(10);
    });

    it("awards 0 points for incorrect text", () => {
      const res = gradeQuestion(question, { questionId: "q-fb", textAnswer: "미안합니다" });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
      expect(res.studentAnswerDisplay).toBe("미안합니다");
    });

    it("awards 0 points for missing or empty text", () => {
      const res1 = gradeQuestion(question, { questionId: "q-fb", textAnswer: "   " });
      expect(res1.isCorrect).toBe(false);
      expect(res1.score).toBe(0);

      const res2 = gradeQuestion(question, undefined);
      expect(res2.isCorrect).toBe(false);
      expect(res2.score).toBe(0);
    });
  });

  describe("gradeQuestion - ARRANGE_SENTENCE", () => {
    const question: RawQuestionWithGrading = {
      id: "q-arr",
      exerciseId: "ex-1",
      type: QuestionType.ARRANGE_SENTENCE,
      prompt: "Sắp xếp thành câu: '저는 학생입니다'",
      correctAnswer: "저는 학생입니다",
      displayOrder: 3,
      options: [
        { id: "tile-1", questionId: "q-arr", text: "저는", isCorrect: false, displayOrder: 1 },
        { id: "tile-2", questionId: "q-arr", text: "학생입니다", isCorrect: false, displayOrder: 2 },
        { id: "tile-3", questionId: "q-arr", text: "선생님", isCorrect: false, displayOrder: 3 },
      ],
    };

    it("awards full points for correct sequence of tiles", () => {
      const res = gradeQuestion(question, {
        questionId: "q-arr",
        selectedOptionIds: ["tile-1", "tile-2"],
      });
      expect(res.isCorrect).toBe(true);
      expect(res.score).toBe(10);
      expect(res.studentAnswerDisplay).toBe("저는 학생입니다");
    });

    it("awards 0 points for wrong tile order", () => {
      const res = gradeQuestion(question, {
        questionId: "q-arr",
        selectedOptionIds: ["tile-2", "tile-1"],
      });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
      expect(res.studentAnswerDisplay).toBe("학생입니다 저는");
    });

    it("awards 0 points if student injects duplicate option IDs", () => {
      const res = gradeQuestion(question, {
        questionId: "q-arr",
        selectedOptionIds: ["tile-1", "tile-1"],
      });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
    });

    it("awards 0 points if student injects foreign tile IDs", () => {
      const res = gradeQuestion(question, {
        questionId: "q-arr",
        selectedOptionIds: ["tile-1", "foreign-tile-99"],
      });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
      expect(res.studentAnswerDisplay).toBe("(Chứa khối từ không hợp lệ)");
    });
  });

  describe("gradeQuestion - LISTENING_CHOICE", () => {
    const question: RawQuestionWithGrading = {
      id: "q-listen",
      exerciseId: "ex-1",
      type: QuestionType.LISTENING_CHOICE,
      prompt: "Nghe phát âm và chọn đáp án:",
      audioUrl: "/audio/lesson1/hangul-a.mp3",
      displayOrder: 4,
      options: [
        { id: "opt-a", questionId: "q-listen", text: "아 (a)", isCorrect: true, displayOrder: 1 },
        { id: "opt-ya", questionId: "q-listen", text: "야 (ya)", isCorrect: false, displayOrder: 2 },
      ],
    };

    it("awards full points for correct audio choice", () => {
      const res = gradeQuestion(question, {
        questionId: "q-listen",
        selectedOptionId: "opt-a",
      });
      expect(res.isCorrect).toBe(true);
      expect(res.score).toBe(10);
    });

    it("awards 0 points for incorrect audio choice", () => {
      const res = gradeQuestion(question, {
        questionId: "q-listen",
        selectedOptionId: "opt-ya",
      });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0);
    });
  });

  describe("gradeExerciseAttempt - Aggregation & 80% Passing Rule", () => {
    const mockExercise: RawExerciseWithGrading = {
      id: "ex-pass-fail",
      lessonId: "les-1",
      title: "Bài kiểm tra tổng hợp",
      description: null,
      displayOrder: 1,
      questions: [
        {
          id: "q1",
          exerciseId: "ex-pass-fail",
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: "Q1",
          displayOrder: 1,
          options: [
            { id: "q1-opt1", questionId: "q1", text: "A", isCorrect: true, displayOrder: 1 },
            { id: "q1-opt2", questionId: "q1", text: "B", isCorrect: false, displayOrder: 2 },
          ],
        },
        {
          id: "q2",
          exerciseId: "ex-pass-fail",
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: "Q2",
          displayOrder: 2,
          options: [
            { id: "q2-opt1", questionId: "q2", text: "A", isCorrect: true, displayOrder: 1 },
          ],
        },
        {
          id: "q3",
          exerciseId: "ex-pass-fail",
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: "Q3",
          displayOrder: 3,
          options: [
            { id: "q3-opt1", questionId: "q3", text: "A", isCorrect: true, displayOrder: 1 },
          ],
        },
        {
          id: "q4",
          exerciseId: "ex-pass-fail",
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: "Q4",
          displayOrder: 4,
          options: [
            { id: "q4-opt1", questionId: "q4", text: "A", isCorrect: true, displayOrder: 1 },
          ],
        },
        {
          id: "q5",
          exerciseId: "ex-pass-fail",
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: "Q5",
          displayOrder: 5,
          options: [
            { id: "q5-opt1", questionId: "q5", text: "A", isCorrect: true, displayOrder: 1 },
          ],
        },
      ],
    };

    it("evaluates passing when score is exactly 80% (4/5 questions)", () => {
      const studentAnswers: StudentQuestionAnswerInput[] = [
        { questionId: "q1", selectedOptionId: "q1-opt1" }, // correct
        { questionId: "q2", selectedOptionId: "q2-opt1" }, // correct
        { questionId: "q3", selectedOptionId: "q3-opt1" }, // correct
        { questionId: "q4", selectedOptionId: "q4-opt1" }, // correct
        { questionId: "q5", selectedOptionId: "wrong-id" }, // wrong
      ];

      const result = gradeExerciseAttempt(mockExercise, studentAnswers);
      expect(result.totalScore).toBe(40);
      expect(result.maxScore).toBe(50);
      expect(result.percentage).toBe(80);
      expect(result.isPassing).toBe(true);
    });

    it("evaluates failing when score is below 80% (3/5 = 60%)", () => {
      const studentAnswers: StudentQuestionAnswerInput[] = [
        { questionId: "q1", selectedOptionId: "q1-opt1" }, // correct
        { questionId: "q2", selectedOptionId: "q2-opt1" }, // correct
        { questionId: "q3", selectedOptionId: "q3-opt1" }, // correct
        { questionId: "q4", selectedOptionId: "wrong-1" }, // wrong
        { questionId: "q5", selectedOptionId: "wrong-2" }, // wrong
      ];

      const result = gradeExerciseAttempt(mockExercise, studentAnswers);
      expect(result.totalScore).toBe(30);
      expect(result.maxScore).toBe(50);
      expect(result.percentage).toBe(60);
      expect(result.isPassing).toBe(false);
    });

    it("handles empty answers safely without crashing", () => {
      const result = gradeExerciseAttempt(mockExercise, []);
      expect(result.totalScore).toBe(0);
      expect(result.maxScore).toBe(50);
      expect(result.percentage).toBe(0);
      expect(result.isPassing).toBe(false);
      expect(result.gradedQuestions).toHaveLength(5);
    });
  });
});

describe("Exercise Service & Security Rules", () => {
  let testStudentA: { id: string; email: string };
  let testStudentB: { id: string; email: string };
  const createdUserIds: string[] = [];
  const seededExerciseId = "e0000000-0000-4000-a000-000000000001";
  const seededLessonId = "l0000000-0000-4000-a000-000000000001";
  const completeAnswers: StudentQuestionAnswerInput[] = [
    { questionId: "q0000000-0000-4000-a000-000000000001", selectedOptionId: "o0000000-0000-4000-a000-000000000001" },
    { questionId: "q0000000-0000-4000-a000-000000000002", selectedOptionId: "o0000000-0000-4000-a000-000000000005" },
    { questionId: "q0000000-0000-4000-a000-000000000003", textAnswer: "유" },
    { questionId: "q0000000-0000-4000-a000-000000000004", selectedOptionId: "o0000000-0000-4000-a000-000000000009" },
  ];

  beforeEach(async () => {
    const timestamp = Date.now() + Math.floor(Math.random() * 10000);
    testStudentA = await prisma.user.create({
      data: {
        id: `test-ex-student-a-${timestamp}`,
        email: `ex_student_a_${timestamp}@example.com`,
        name: "Học Viên A",
        role: "STUDENT",
      },
    });

    testStudentB = await prisma.user.create({
      data: {
        id: `test-ex-student-b-${timestamp}`,
        email: `ex_student_b_${timestamp}@example.com`,
        name: "Học Viên B",
        role: "STUDENT",
      },
    });
    createdUserIds.push(testStudentA.id, testStudentB.id);

    // Enroll student A in course so lesson progress can be recorded
    const course = await prisma.course.findFirstOrThrow({
      where: { slug: "tieng-han-tu-con-so-0" },
    });
    await prisma.enrollment.create({
      data: {
        userId: testStudentA.id,
        courseId: course.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("rejects submissions for nonexistent or unpublished exercises", async () => {
    await expect(
      exerciseService.submitAttempt({
        userId: testStudentA.id,
        exerciseId: "nonexistent-exercise-id",
        answers: [],
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("submits attempt, scores on server, records startedAt and submittedAt, and triggers lesson completion if passing", async () => {
    const startedAt = new Date(Date.now() - 60000); // 1 minute ago
    const answers: StudentQuestionAnswerInput[] = [
      {
        questionId: "q0000000-0000-4000-a000-000000000001",
        selectedOptionId: "o0000000-0000-4000-a000-000000000001", // correct
      },
      {
        questionId: "q0000000-0000-4000-a000-000000000002",
        selectedOptionId: "o0000000-0000-4000-a000-000000000005", // correct
      },
      {
        questionId: "q0000000-0000-4000-a000-000000000003",
        textAnswer: "유", // correct fill blank
      },
      {
        questionId: "q0000000-0000-4000-a000-000000000004",
        selectedOptionId: "o0000000-0000-4000-a000-000000000009", // correct listening choice
      },
    ];

    const submission = await exerciseService.submitAttempt({
      userId: testStudentA.id,
      exerciseId: seededExerciseId,
      answers,
      startedAt,
    });

    expect(submission.attemptId).toBeDefined();
    expect(submission.totalScore).toBe(40);
    expect(submission.maxScore).toBe(40);
    expect(submission.percentage).toBe(100);
    expect(submission.isPassing).toBe(true);

    // Verify stored in DB
    const dbAttempt = await prisma.exerciseAttempt.findUnique({
      where: { id: submission.attemptId },
      include: { answers: true },
    });
    expect(dbAttempt).not.toBeNull();
    expect(dbAttempt?.score).toBe(40);
    expect(dbAttempt?.isPassing).toBe(true);
    expect(dbAttempt?.answers).toHaveLength(4);
    expect(dbAttempt?.startedAt).toBeDefined();
    expect(dbAttempt?.submittedAt).toBeDefined();

    // Verify lesson completion was triggered
    const progress = await prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: testStudentA.id,
          lessonId: seededLessonId,
        },
      },
    });
    expect(progress?.status).toBe(LessonProgressStatus.COMPLETED);
    expect(progress?.completedAt).not.toBeNull();
  });

  it("handles duplicate network submissions idempotently", async () => {
    const idempotencyKey = `test-idem-${Date.now()}`;
    const answers = completeAnswers;

    // First submission
    const firstRes = await exerciseService.submitAttempt({
      userId: testStudentA.id,
      exerciseId: seededExerciseId,
      answers,
      idempotencyKey,
    });

    // Duplicate submission with same idempotencyKey
    const secondRes = await exerciseService.submitAttempt({
      userId: testStudentA.id,
      exerciseId: seededExerciseId,
      answers,
      idempotencyKey,
    });

    expect(secondRes.attemptId).toBe(firstRes.attemptId);
    expect(secondRes).toEqual(firstRes);
    expect(secondRes.gradedQuestions.map((q) => q.questionId)).toEqual(completeAnswers.map((a) => a.questionId));

    // Verify only ONE attempt was created in database for this key
    const count = await prisma.exerciseAttempt.count({
      where: { idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it("enforces user isolation: students cannot view other students' attempts", async () => {
    // Create attempt for Student A
    const sub = await exerciseService.submitAttempt({
      userId: testStudentA.id,
      exerciseId: seededExerciseId,
      answers: completeAnswers,
    });

    // Student A can view
    const ownResult = await exerciseService.getAttemptResultForStudent(
      sub.attemptId,
      testStudentA.id
    );
    expect(ownResult.attemptId).toBe(sub.attemptId);

    // Student B cannot view Student A's attempt
    await expect(
      exerciseService.getAttemptResultForStudent(sub.attemptId, testStudentB.id)
    ).rejects.toThrow(ForbiddenError);
  });
});
