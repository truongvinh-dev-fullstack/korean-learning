import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { adminService } from "@/modules/admin/admin.service";
import { ValidationError, ConflictError } from "@/shared/errors/domain-errors";
import { mapContentBlockDtoToForm, mapContentBlockFormToPayload } from "@/modules/lessons/lesson-content";
import { gradeQuestion, gradeExerciseAttempt } from "@/modules/exercises/scoring";
import { exerciseRepository } from "@/modules/exercises/exercise.repository";
import { serializeExerciseResult } from "@/modules/exercises/result";

const admin = { role: "ADMIN" };
let courseId: string, lessonId: string;
const userIds: string[] = [];
beforeEach(async () => {
  const course = await prisma.course.create({ data: { title: "QA", slug: `qa-${randomUUID()}`, description: "QA",
    chapters: { create: { title: "Chapter", slug: "chapter", lessons: { create: { title: "Lesson", slug: `qa-${randomUUID()}` } } } } },
    include: { chapters: { include: { lessons: true } } } });
  courseId = course.id; lessonId = course.chapters[0].lessons[0].id;
});
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await prisma.course.delete({ where: { id: courseId } });
});
async function learner() {
  const user = await prisma.user.create({ data: { id: randomUUID(), name: "QA", email: `${randomUUID()}@example.com` } }); userIds.push(user.id); return user;
}

describe("Lesson Detail QA: persistence and publication boundaries", () => {
  it("preserves choice IDs when editing or reordering a question's existing options", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "Stable IDs" });
    const question = await adminService.createQuestion(admin, { exerciseId: exercise.id, type: "MULTIPLE_CHOICE", prompt: "Choose", options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] });
    if (!question) throw new Error("Missing question");
    const edited = await adminService.updateQuestion(admin, question.id, { prompt: "Edited", options: [...question.options].reverse().map((option, index) => ({ ...option, displayOrder: index })) });
    expect(edited?.options.map((option) => option.id)).toEqual([...question.options].reverse().map((option) => option.id));
    await expect(adminService.updateQuestion(admin, question.id, { options: [{ ...question.options[0], id: "foreign-option" }, question.options[1]] })).rejects.toThrow(ValidationError);
    expect((await prisma.question.findUniqueOrThrow({ where: { id: question.id }, include: { options: { orderBy: { displayOrder: "asc" } } } })).options.map((option) => option.id)).toEqual(edited?.options.map((option) => option.id));
  });
  it("uses the newest legacy correctAnswer on repeated partial fill-blank edits", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "Fill" });
    const question = await adminService.createQuestion(admin, { exerciseId: exercise.id, type: "FILL_BLANK", prompt: "Fill", correctAnswer: "아" });
    if (!question) throw new Error("Question missing");
    await adminService.updateQuestion(admin, question.id, { correctAnswer: "오" });
    await adminService.updateQuestion(admin, question.id, { correctAnswer: "유" });
    const stored = await prisma.question.findUniqueOrThrow({ where: { id: question.id }, include: { options: true } });
    expect(stored.content).toMatchObject({ answers: ["유"] });
    expect(gradeQuestion(stored, { questionId: stored.id, textAnswer: "유" }).isCorrect).toBe(true);
  });
  it("rejects a published exercise with invalid stored metadata when publishing its lesson", async () => {
    const exercise = await prisma.exercise.create({ data: { lessonId, title: "", status: "PUBLISHED" } });
    await prisma.question.create({ data: { exerciseId: exercise.id, type: "FILL_BLANK", prompt: "Fill", correctAnswer: "유" } });
    await expect(adminService.updateLesson(admin, lessonId, { status: "PUBLISHED" })).rejects.toThrow(ValidationError);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } })).status).toBe("DRAFT");
  });
  it("keeps incomplete lesson drafts but refuses publication of empty exercises", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "Draft", status: "DRAFT" });
    await adminService.updateLesson(admin, lessonId, { summary: "Work in progress", status: "DRAFT" });
    await expect(adminService.updateExercise(admin, exercise.id, { status: "PUBLISHED" })).rejects.toThrow(ValidationError);
  });
  it("prevents a live lesson acquiring an empty published exercise", async () => {
    await adminService.updateLesson(admin, lessonId, { status: "PUBLISHED" });
    await expect(adminService.createExercise(admin, { lessonId, title: "Empty", status: "PUBLISHED" })).rejects.toThrow(ValidationError);
    expect(await prisma.exercise.count({ where: { lessonId } })).toBe(0);
  });
  it("keeps legacy extension fields through parser, form, API and database", async () => {
    const content = { title: "Legacy", description: "Guide", teacherNote: "Keep", characters: [{ char: "ㅏ", romanization: "a", name: "a", strokeImage: "/guide.svg" }] };
    const block = await prisma.lessonBlock.create({ data: { lessonId, type: "HANGUL", content } });
    const form = mapContentBlockDtoToForm(block);
    const payload = mapContentBlockFormToPayload(form);
    await adminService.updateBlock(admin, block.id, payload);
    expect((await prisma.lessonBlock.findUniqueOrThrow({ where: { id: block.id } })).content).toMatchObject(content);
  });
  it("protects vocabulary references even if their legacy block has other invalid fields", async () => {
    const word = await adminService.createVocabulary(admin, { lessonId, hangul: "아이", romanization: "ai", vietnameseMeaning: "Em bé" });
    await prisma.lessonBlock.create({ data: { lessonId, type: "VOCABULARY", content: { vocabularyIds: [word.id], items: [] } } });
    await expect(adminService.deleteVocabulary(admin, word.id)).rejects.toThrow(ConflictError);
    expect(await prisma.vocabulary.findUnique({ where: { id: word.id } })).not.toBeNull();
  });
  it("inserts at displayOrder zero and between blocks without duplicate order", async () => {
    const a = await adminService.createBlock(admin, { lessonId, type: "TEXT", content: { markdown: "A" } });
    const b = await adminService.createBlock(admin, { lessonId, type: "TEXT", content: { markdown: "B" } });
    const first = await adminService.createBlock(admin, { lessonId, type: "TEXT", content: { markdown: "First" }, displayOrder: 0 });
    const middle = await adminService.createBlock(admin, { lessonId, type: "TEXT", content: { markdown: "Middle" }, displayOrder: 2 });
    const blocks = await adminService.getBlocksByLessonId(admin, lessonId);
    expect(blocks.map((block) => block.id)).toEqual([first.id, a.id, middle.id, b.id]);
    expect(new Set(blocks.map((block) => block.displayOrder)).size).toBe(4);
    await adminService.updateBlock(admin, b.id, { displayOrder: 1 });
    expect((await adminService.getBlocksByLessonId(admin, lessonId)).map((block) => block.id)).toEqual([first.id, b.id, a.id, middle.id]);
    await adminService.deleteBlock(admin, a.id);
    expect((await adminService.getBlocksByLessonId(admin, lessonId)).map((block) => block.id)).toEqual([first.id, b.id, middle.id]);
  });
  it("does not assign duplicate vocabulary orders to concurrent create requests", async () => {
    await Promise.all(["아이", "오이", "우유"].map((hangul) => adminService.createVocabulary(admin, { lessonId, hangul, romanization: "word", vietnameseMeaning: "Word" })));
    const words = await adminService.getVocabulariesByLessonId(admin, lessonId);
    expect(new Set(words.map((word) => word.displayOrder)).size).toBe(3);
  });
  it("repairs duplicate legacy orders outside the particular swapped pair", async () => {
    await prisma.lessonBlock.create({ data: { id: "qa-order-a", lessonId, type: "TEXT", content: { markdown: "A" }, displayOrder: 0 } });
    const b = await prisma.lessonBlock.create({ data: { id: "qa-order-b", lessonId, type: "TEXT", content: { markdown: "B" }, displayOrder: 1 } });
    await prisma.lessonBlock.create({ data: { id: "qa-order-c", lessonId, type: "TEXT", content: { markdown: "C" }, displayOrder: 1 } });
    const rows = await adminService.reorderBlock(admin, b.id, { direction: "UP" });
    expect(rows.map((row) => row.id)).toEqual(["qa-order-b", "qa-order-a", "qa-order-c"]);
    expect(new Set(rows.map((row) => row.displayOrder)).size).toBe(3);
  });
  it("inserts, moves, deletes and reloads vocabulary, exercises and questions without duplicate order", async () => {
    const a = await adminService.createVocabulary(admin, { lessonId, hangul: "아이", romanization: "ai", vietnameseMeaning: "A" });
    const b = await adminService.createVocabulary(admin, { lessonId, hangul: "오이", romanization: "oi", vietnameseMeaning: "B" });
    const c = await adminService.createVocabulary(admin, { lessonId, hangul: "우유", romanization: "uyu", vietnameseMeaning: "C", displayOrder: 1 });
    await adminService.updateVocabulary(admin, b.id, { displayOrder: 0 });
    await adminService.deleteVocabulary(admin, a.id);
    expect((await adminService.getVocabulariesByLessonId(admin, lessonId)).map((row) => row.id)).toEqual([b.id, c.id]);
    const first = await adminService.createExercise(admin, { lessonId, title: "A" });
    const last = await adminService.createExercise(admin, { lessonId, title: "B" });
    const mid = await adminService.createExercise(admin, { lessonId, title: "C", displayOrder: 1 });
    await adminService.updateExercise(admin, last.id, { displayOrder: 0 });
    await adminService.deleteExercise(admin, first.id);
    expect((await adminService.getExercisesByLessonId(admin, lessonId)).map((row) => row.id)).toEqual([last.id, mid.id]);
    const q1 = await adminService.createQuestion(admin, { exerciseId: mid.id, type: "FILL_BLANK", prompt: "A", correctAnswer: "A" });
    const q2 = await adminService.createQuestion(admin, { exerciseId: mid.id, type: "FILL_BLANK", prompt: "B", correctAnswer: "B" });
    const q3 = await adminService.createQuestion(admin, { exerciseId: mid.id, type: "FILL_BLANK", prompt: "C", correctAnswer: "C", displayOrder: 1 });
    if (!q1 || !q2 || !q3) throw new Error("Missing question");
    await adminService.updateQuestion(admin, q2.id, { displayOrder: 0 }); await adminService.deleteQuestion(admin, q1.id);
    const questions = (await adminService.getExercisesByLessonId(admin, lessonId)).find((row) => row.id === mid.id)?.questions;
    if (!questions) throw new Error("Missing exercise");
    expect(questions.map((row) => row.id)).toEqual([q2.id, q3.id]); expect(new Set(questions.map((row) => row.displayOrder)).size).toBe(2);
  });
  it.each([
    { type: "TEXT", content: { markdown: "Legacy", teacherNote: "Keep" } },
    { type: "VOCABULARY", content: { items: [{ hangul: "아이", romanization: "ai", vietnamese: "Em bé", dialect: "Seoul" }], teacherNote: "Keep" } },
    { type: "AUDIO", content: { audioUrl: "/audio/vocab/ai.ogg", sourceCredit: "Keep" } },
    { type: "CALLOUT", content: { message: "Legacy", variant: "info", teacherNote: "Keep" } },
  ] as const)("keeps $type legacy content intact through form save and database reload", async ({ type, content }) => {
    const block = await prisma.lessonBlock.create({ data: { lessonId, type, content } });
    await adminService.updateBlock(admin, block.id, mapContentBlockFormToPayload(mapContentBlockDtoToForm(block)));
    expect((await prisma.lessonBlock.findUniqueOrThrow({ where: { id: block.id } })).content).toMatchObject(content);
  });
  it("does not persist grades computed from questions changed before the attempt transaction", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "Versions" });
    const question = await adminService.createQuestion(admin, { exerciseId: exercise.id, type: "FILL_BLANK", prompt: "Fill", correctAnswer: "A" });
    if (!question) throw new Error("Missing question");
    const raw = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id }, include: { questions: { include: { options: true } } } });
    const answers = [{ questionId: question.id, textAnswer: "A" }];
    await adminService.updateQuestion(admin, question.id, { correctAnswer: "B" }); const user = await learner();
    await expect(exerciseRepository.recordAttemptTransaction({ userId: user.id, exerciseId: exercise.id, rawAnswers: answers,
      gradingResult: gradeExerciseAttempt(raw, answers), startedAt: new Date(), submittedAt: new Date(),
      questionVersions: raw.questions.map(({ id, updatedAt }) => ({ id, updatedAt })) })).rejects.toThrow(ConflictError);
    expect(await prisma.exerciseAttempt.count({ where: { exerciseId: exercise.id } })).toBe(0);
  });
  it("replays ordering answers with comma-containing IDs without losing the original selection", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "ID encoding" });
    const question = await adminService.createQuestion(admin, { exerciseId: exercise.id, type: "ORDERING", prompt: "Order", content: {
      items: [{ id: "a,1", text: "First" }, { id: "b,2", text: "Second" }], correctOrder: ["b,2", "a,1"] } });
    if (!question) throw new Error("Missing question");
    const raw = await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id }, include: { questions: { include: { options: true } } } });
    const answers = [{ questionId: question.id, selectedOptionIds: ["b,2", "a,1"] }], user = await learner();
    const attempt = await exerciseRepository.recordAttemptTransaction({ userId: user.id, exerciseId: exercise.id, rawAnswers: answers,
      gradingResult: gradeExerciseAttempt(raw, answers), startedAt: new Date(), submittedAt: new Date() });
    const stored = await exerciseRepository.findAttemptById(attempt.id); if (!stored) throw new Error("Missing attempt");
    expect(serializeExerciseResult(stored).gradedQuestions[0].studentAnswerDisplay).toBe(gradeExerciseAttempt(raw, answers).gradedQuestions[0].studentAnswerDisplay);
    await expect(adminService.createQuestion(admin, { exerciseId: exercise.id, type: "FILL_BLANK", prompt: "New", correctAnswer: "A" })).rejects.toThrow(ConflictError);
    await expect(adminService.deleteExercise(admin, exercise.id)).rejects.toThrow(ConflictError);
    await expect(adminService.deleteLesson(admin, lessonId)).rejects.toThrow(ConflictError);
  });
  it("refuses deleting the final question in a live published exercise", async () => {
    const exercise = await adminService.createExercise(admin, { lessonId, title: "Live" });
    const question = await adminService.createQuestion(admin, { exerciseId: exercise.id, type: "FILL_BLANK", prompt: "Fill", correctAnswer: "A" });
    if (!question) throw new Error("Missing question");
    await adminService.updateExercise(admin, exercise.id, { status: "PUBLISHED" }); await adminService.updateLesson(admin, lessonId, { status: "PUBLISHED" });
    await expect(adminService.deleteQuestion(admin, question.id)).rejects.toThrow(ConflictError);
    await adminService.updateExercise(admin, exercise.id, { status: "DRAFT" }); await adminService.deleteQuestion(admin, question.id);
    expect(await prisma.question.count({ where: { exerciseId: exercise.id } })).toBe(0);
  });
  it("has applied the additive migration once with correct defaults, enums, parent indexes and no block-vocabulary cascade", async () => {
    const migrations = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE migration_name = '20261003090000_lesson_authoring' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    expect(migrations[0].count).toBe(BigInt(1));
    const columns = await prisma.$queryRaw<{ table_name: string; column_name: string; is_nullable: string; column_default: string | null }[]>`SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('Lesson', 'Vocabulary', 'Question')`;
    expect(columns.find((col) => col.table_name === "Question" && col.column_name === "content")?.is_nullable).toBe("YES");
    for (const name of ["tags", "learningObjectives"]) expect(columns.find((col) => col.table_name === "Lesson" && col.column_name === name)).toMatchObject({ is_nullable: "NO", column_default: expect.stringContaining("ARRAY[]") });
    const enums = await prisma.$queryRaw<{ enumlabel: string }[]>`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname IN ('BlockType', 'QuestionType')`;
    for (const value of ["EXAMPLE", "IMAGE", "TRUE_FALSE", "PRONUNCIATION"]) expect(enums.map((row) => row.enumlabel)).toContain(value);
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('LessonBlock', 'Vocabulary', 'Exercise', 'Question')`;
    expect(indexes.filter((row) => row.indexdef.includes('"displayOrder"')).length).toBe(4);
    const word = await adminService.createVocabulary(admin, { lessonId, hangul: "아이", romanization: "ai", vietnameseMeaning: "Em bé" });
    const block = await adminService.createBlock(admin, { lessonId, type: "VOCABULARY", content: { vocabularyIds: [word.id] } });
    await adminService.deleteBlock(admin, block.id); expect(await prisma.vocabulary.findUnique({ where: { id: word.id } })).not.toBeNull();
  });
});
