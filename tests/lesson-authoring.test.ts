import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { adminService } from "@/modules/admin/admin.service";
import { LessonBlockFormSchema, QuestionFormSchema } from "@/modules/admin/admin.schema";
import { mapContentBlockDtoToForm, mapContentBlockFormToPayload, resolveVocabularyContent } from "@/modules/lessons/lesson-content";
import { exerciseService, sanitizeExerciseForStudent } from "@/modules/exercises/exercise.service";
import { validateExerciseAnswers, gradeExerciseAttempt, type StudentQuestionAnswerInput } from "@/modules/exercises/scoring";
import { parseQuestionContent } from "@/modules/exercises/question.schema";
import { ConflictError, ValidationError } from "@/shared/errors/domain-errors";
import { lessonService } from "@/modules/lessons/lesson.service";

const admin = { role: "ADMIN" };
let courseId: string, chapterId: string, lessonId: string;
const userIds: string[] = [];
beforeEach(async () => {
  const course = await prisma.course.create({ data: { slug: `authoring-${randomUUID()}`, title: "Authoring", description: "Authoring", status: "PUBLISHED",
    chapters: { create: { slug: "chapter", title: "Chapter", status: "PUBLISHED", lessons: { create: { slug: `authoring-${randomUUID()}`, title: "Lesson" } } } } },
    include: { chapters: { include: { lessons: true } } } });
  courseId = course.id; chapterId = course.chapters[0].id; lessonId = course.chapters[0].lessons[0].id;
});
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await prisma.course.delete({ where: { id: courseId } });
});

describe("Lesson authoring compatibility and references", () => {
  it("persists optional metadata and objective order through partial updates without clearing content", async () => {
    await adminService.updateLesson(admin, lessonId, { level: "BEGINNER_1", tags: ["hangul"], learningObjectives: ["Read", "Write"], estimatedMinutes: 0 });
    await adminService.updateLesson(admin, lessonId, { learningObjectives: ["Write", "Read"] });
    const lesson = await adminService.getLessonById(admin, lessonId);
    expect(lesson).toMatchObject({ level: "BEGINNER_1", tags: ["hangul"], learningObjectives: ["Write", "Read"], estimatedMinutes: 0 });
    await expect(adminService.updateLesson(admin, lessonId, { title: "", status: "PUBLISHED" })).rejects.toThrow(ValidationError);
    await expect(adminService.updateLesson(admin, lessonId, { learningObjectives: [""] })).rejects.toThrow(ValidationError);
    expect(lesson.chapterId).toBe(chapterId);
  });
  it("resolves references from one bank, rejects foreign/missing IDs and protects deletion", async () => {
    const word = await adminService.createVocabulary(admin, { lessonId, hangul: "아이", romanization: "ai", vietnameseMeaning: "Em bé", difficulty: 1, tags: ["hangul"] });
    const block = await adminService.createBlock(admin, { lessonId, type: "VOCABULARY", content: { title: "Words", vocabularyIds: [word.id] } });
    await adminService.updateVocabulary(admin, word.id, { vietnameseMeaning: "Đứa trẻ" });
    const reloaded = await adminService.getLessonById(admin, lessonId);
    const parsed = mapContentBlockDtoToForm(reloaded.blocks[0]);
    expect(parsed.type).toBe("VOCABULARY");
    if (parsed.type === "VOCABULARY") expect(resolveVocabularyContent(parsed.content, reloaded.vocabularies)[0].vietnamese).toBe("Đứa trẻ");
    expect(block.content).not.toHaveProperty("items");
    await expect(adminService.deleteVocabulary(admin, word.id)).rejects.toThrow(ConflictError);
    const other = await adminService.createLesson(admin, { chapterId, title: "Other", slug: `other-${randomUUID()}` });
    await expect(adminService.createBlock(admin, { lessonId: other.id, type: "VOCABULARY", content: { vocabularyIds: [word.id] } })).rejects.toThrow(ValidationError);
    await expect(adminService.updateBlock(admin, block.id, { content: { vocabularyIds: ["missing"] } })).rejects.toThrow(ValidationError);
    await adminService.deleteBlock(admin, block.id); await adminService.deleteVocabulary(admin, word.id);
  });
  it("round-trips legacy grammar aliases and all per-line media without a backfill", async () => {
    const content = { title: "Grammar", formula: "N", explanation: "Description", examples: [{ korean: "아이", vietnamese: "Em bé", note: "Note", audioUrl: "/audio/vocab/ai.ogg" }] };
    const form = mapContentBlockDtoToForm({ type: "GRAMMAR", content });
    if (form.type !== "GRAMMAR") throw new Error("Wrong form");
    form.content.pattern = "N + suffix";
    const payload = mapContentBlockFormToPayload(form);
    expect(payload.content).toMatchObject({ formula: "N + suffix", explanation: "Description", examples: content.examples });
    const block = await adminService.createBlock(admin, { lessonId, ...payload });
    expect((await adminService.updateBlock(admin, block.id, { displayOrder: 5 })).content).toEqual(block.content);
    expect(LessonBlockFormSchema.safeParse({ lessonId, type: "VOCABULARY", content: { items: [{ hangul: "아이", romanization: "ai", vietnamese: "Em bé" }] } }).success).toBe(true);
  });
  it("reorders legacy duplicate displayOrder values without touching other lessons", async () => {
    await prisma.lessonBlock.createMany({ data: ["a", "b"].map((suffix) => ({ id: `${lessonId}-${suffix}`, lessonId, type: "TEXT", content: { markdown: suffix }, displayOrder: 0 })) });
    const before = await adminService.getBlocksByLessonId(admin, lessonId);
    const after = await adminService.reorderBlock(admin, before[1].id, { direction: "UP" });
    expect(after.map((block) => block.id)).toEqual([before[1].id, before[0].id]);
    expect(new Set(after.map((block) => block.displayOrder)).size).toBe(2);
  });
  it("validates stored blocks and published exercises before publishing lesson", async () => {
    await prisma.lessonBlock.create({ data: { lessonId, type: "TEXT", content: {} } });
    await expect(adminService.updateLesson(admin, lessonId, { status: "PUBLISHED" })).rejects.toThrow(ValidationError);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } })).status).toBe("DRAFT");
  });
  it("stores writing and pronunciation drafts and refuses unsupported publication", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "Manual", status: "DRAFT" });
    for (const type of ["WRITING", "PRONUNCIATION"]) await adminService.createQuestion(admin, { exerciseId: exercise.id, type, prompt: "Task", content: { prompt: "Task", gradingMode: "MANUAL" } });
    await expect(adminService.updateExercise(admin, exercise.id, { status: "PUBLISHED" })).rejects.toThrow(ValidationError);
    expect((await adminService.getLessonById(admin, lessonId)).exercises[0].questions).toHaveLength(2);
  });
});

describe("Structured questions, scoring and student privacy", () => {
  it("authors, publishes, submits and replays all automatic types without exposing solutions", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "Automatic types" });
    const choices = [{ text: "아이", isCorrect: true }, { text: "오이", isCorrect: false }];
    const cases = [
      { type: "MULTIPLE_CHOICE", options: choices },
      { type: "LISTENING_CHOICE", options: choices, audioUrl: "/audio/exercises/vowel-a.ogg" },
      { type: "MULTIPLE_SELECT", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }, { text: "c", isCorrect: false }] },
      { type: "TRUE_FALSE", content: { correctAnswer: false } },
      { type: "FILL_BLANK", content: { answers: ["유", "yu"], caseSensitive: true } },
      { type: "MATCHING", content: { pairs: [{ leftId: "left-a", rightId: "right-x", left: "아이", right: "Em bé" }, { leftId: "left-b", rightId: "right-y", left: "오이", right: "Dưa chuột" }] } },
      { type: "ORDERING", content: { items: [{ id: "i-a", text: "아" }, { id: "i-b", text: "이" }], correctOrder: ["i-b", "i-a"] } },
      { type: "TRANSLATION", content: { source: "아이", acceptedAnswers: ["Em bé", "Đứa trẻ"] } },
    ];
    for (const entry of cases) await adminService.createQuestion(admin, { ...entry, exerciseId: exercise.id, prompt: "Knowledge already introduced" });
    await adminService.updateExercise(admin, exercise.id, { status: "PUBLISHED" });
    await adminService.updateLesson(admin, lessonId, { status: "PUBLISHED" });
    const raw = (await adminService.getLessonById(admin, lessonId)).exercises[0];
    const publicDto = sanitizeExerciseForStudent(raw);
    const json = JSON.stringify(publicDto);
    for (const secret of ["correctAnswer", "correctAnswers", "correctOrder", "isCorrect", "acceptedAnswers", "caseSensitive", '"pairs"']) expect(json).not.toContain(secret);
    expect(publicDto.questions.find((question) => question.type === "MATCHING")?.content?.rightItems).toHaveLength(2);
    const answers: StudentQuestionAnswerInput[] = raw.questions.map((question) => {
      switch (question.type) {
        case "MULTIPLE_CHOICE": case "LISTENING_CHOICE": return { questionId: question.id, selectedOptionId: question.options.find((option) => option.isCorrect)!.id };
        case "MULTIPLE_SELECT": return { questionId: question.id, selectedOptionIds: question.options.filter((option) => option.isCorrect).map((option) => option.id) };
        case "TRUE_FALSE": return { questionId: question.id, textAnswer: "false" };
        case "FILL_BLANK": return { questionId: question.id, textAnswer: "유" };
        case "MATCHING": return { questionId: question.id, textAnswer: JSON.stringify({ "left-a": "right-x", "left-b": "right-y" }) };
        case "ORDERING": return { questionId: question.id, selectedOptionIds: ["i-b", "i-a"] };
        default: return { questionId: question.id, textAnswer: "Đứa trẻ" };
      }
    });
    expect(() => validateExerciseAnswers(raw, answers)).not.toThrow();
    expect(gradeExerciseAttempt(raw, answers).percentage).toBe(100);
    const learner = await prisma.user.create({ data: { id: randomUUID(), name: "Authoring student", email: `${randomUUID()}@example.com` } }); userIds.push(learner.id);
    await prisma.enrollment.create({ data: { userId: learner.id, courseId } });
    const request = { userId: learner.id, exerciseId: exercise.id, answers, idempotencyKey: randomUUID() };
    const result = await exerciseService.submitAttempt(request), replay = await exerciseService.submitAttempt(request);
    expect(replay).toEqual(result); expect(result.percentage).toBe(100);
    expect((await lessonService.getPublishedLessonBySlug((await adminService.getLessonById(admin, lessonId)).slug, learner.id))?.blocks).toEqual([]);
    await expect(adminService.updateQuestion(admin, raw.questions[0].id, { prompt: "Changed" })).rejects.toThrow(ConflictError);
    const orderQuestion = raw.questions.find((question) => question.type === "ORDERING")!;
    expect(() => validateExerciseAnswers(raw, answers.map((answer) => answer.questionId === orderQuestion.id ? { ...answer, selectedOptionIds: ["foreign", "i-b"] } : answer))).toThrow(ValidationError);
    const fill = raw.questions.find((question) => question.type === "FILL_BLANK")!;
    expect(parseQuestionContent("FILL_BLANK", fill.content).answers).toEqual(["유", "yu"]);
  });
  it.each([
    { type: "MULTIPLE_CHOICE", options: [{ text: "A", isCorrect: true }] },
    { type: "MULTIPLE_SELECT", options: [{ text: "A" }, { text: "B" }] },
    { type: "LISTENING_CHOICE", options: [{ text: "A", isCorrect: true }, { text: "B" }] },
    { type: "FILL_BLANK", content: { answers: [] } },
    { type: "MATCHING", content: { pairs: [] } },
    { type: "ORDERING", content: { items: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOrder: ["a", "a"] } },
  ])("rejects malformed $type authoring payload", (payload) => {
    expect(QuestionFormSchema.safeParse({ exerciseId: "exercise", prompt: "Question", ...payload }).success).toBe(false);
  });
});
