import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";
import valid from "../docs/examples/ai/valid-lesson-generation.json";
import invalidKnowledge from "../docs/examples/ai/invalid-knowledge-generation.json";
import { prisma } from "@/shared/db/prisma";
import { AiLessonService } from "@/modules/ai-lessons/ai-lesson.service";
import { AiLessonRepository } from "@/modules/ai-lessons/ai-lesson.repository";
import type { AiLessonTarget } from "@/modules/ai-lessons/ai-lesson.schema";
import { aiImportHash, issueAiValidationToken, verifyAiValidationToken } from "@/modules/ai-lessons/ai-lesson-token";

let courseId: string, chapterId: string, lessonId: string;
const admin = { id: randomUUID(), role: "ADMIN" };
const repo = new AiLessonRepository(), service = new AiLessonService({ generateLesson: async () => structuredClone(valid) }, repo);
const input = { topic: "10 nguyên âm cơ bản", level: "BEGINNER_1", lessonNumber: 1, duration: 20, targetAudience: null, notes: null };
beforeEach(async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  const course = await prisma.course.create({ data: { title: "AI QA", slug: `ai-${randomUUID()}`, description: "QA", chapters: { create: { title: "Chapter", slug: "chapter", lessons: { create: { title: "Original", slug: `original-${randomUUID()}`, learningObjectives: ["Legacy objective"] } } } } }, include: { chapters: { include: { lessons: true } } } });
  courseId = course.id; chapterId = course.chapters[0].id; lessonId = course.chapters[0].lessons[0].id;
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await prisma.aiLessonImport.deleteMany({ where: { userId: admin.id } }); await prisma.aiLessonGenerationLimit.deleteMany({ where: { userId: admin.id } }); await prisma.course.delete({ where: { id: courseId } }); });
async function payload(target: AiLessonTarget = { mode: "NEW", chapterId }) {
  const data = structuredClone(valid); data.lesson.slug = `ai-draft-${randomUUID()}`;
  const preview = await service.validateDraft(admin, data, target);
  if (!preview.draft || !preview.validationToken) throw new Error(JSON.stringify(preview.validation));
  return { draft: preview.draft, target, validationToken: preview.validationToken, idempotencyKey: randomUUID(), confirmed: true as const, replaceConfirmed: target.mode === "REPLACE" };
}
async function graph(id: string) { return prisma.lesson.findUniqueOrThrow({ where: { id }, include: { blocks: { orderBy: { displayOrder: "asc" } }, vocabularies: { orderBy: { displayOrder: "asc" } }, exercises: { orderBy: { displayOrder: "asc" }, include: { questions: { orderBy: { displayOrder: "asc" }, include: { options: { orderBy: { displayOrder: "asc" } } } } } } } }); }

it("generate and validate never write a lesson, vocabulary, block or receipt", async () => {
  const before = await graph(lessonId); const target = { mode: "APPEND", lessonId };
  const result = await service.generateDraft(admin, input, target); expect(result.validation.valid).toBe(true); expect(await graph(lessonId)).toEqual(before); expect(await prisma.aiLessonImport.count({ where: { userId: admin.id } })).toBe(0);
});
it("preserves signed generation provenance through edits/revalidation and stores it outside lesson content", async () => {
  const requestId = randomUUID(), target = { mode: "NEW" as const, chapterId };
  const generated = await service.generateDraft(admin, input, target, requestId);
  const draft = structuredClone(generated.draft!); draft.lesson.slug = `provenance-${randomUUID()}`; draft.lesson.title = "Admin edit";
  const checked = await service.validateDraft(admin, draft, target, generated.generationToken);
  const key = randomUUID(), p = { target, draft: checked.draft, validationToken: checked.validationToken, generationToken: generated.generationToken, idempotencyKey: key, confirmed: true, replaceConfirmed: false };
  await expect(service.importAiLessonDraft(admin, { ...p, generationToken: undefined })).rejects.toThrow("thay đổi");
  const result = await service.importAiLessonDraft(admin, p);
  expect((await prisma.aiLessonImport.findUniqueOrThrow({ where: { idempotencyKey: key } })).generationMetadata).toMatchObject({ requestId, promptVersion: "lesson-authoring-v1", provider: "custom", model: "custom" });
  expect(JSON.stringify((await graph(result.lessonId)).blocks)).not.toContain("promptVersion");
  expect((await service.importAiLessonDraft(admin, p)).replayed).toBe(true);
});
it("imports a full DRAFT graph with objectives/questions/options and remapped DB vocabulary IDs", async () => {
  const p = await payload(); const result = await service.importAiLessonDraft(admin, p); const stored = await graph(result.lessonId);
  expect(stored.status).toBe("DRAFT"); expect(stored.learningObjectives).toEqual(p.draft.learningObjectives); expect(stored.blocks).toHaveLength(5); expect(stored.vocabularies).toHaveLength(5); expect(stored.exercises[0].status).toBe("DRAFT"); expect(stored.exercises[0].questions).toHaveLength(4); expect(stored.exercises[0].questions[0].options).toHaveLength(3);
  const block = stored.blocks.find((b) => b.type === "VOCABULARY"); expect(block?.content).toEqual({ title: "Từ vựng cấu tạo từ nguyên âm", vocabularyIds: stored.vocabularies.map((v) => v.id) }); expect(JSON.stringify(block?.content)).not.toContain("vocab-1");
});
it("rolls back all graph writes and receipt after a question DB failure", async () => {
  const p = await payload(); const original = repo.writeQuestions.bind(repo);
  vi.spyOn(repo, "writeQuestions").mockImplementation(async (tx, exerciseId, questions) => { await original(tx, exerciseId, questions); await tx.question.create({ data: { exerciseId: randomUUID(), type: "MULTIPLE_CHOICE", prompt: "Fault" } }); });
  await expect(service.importAiLessonDraft(admin, p)).rejects.toThrow("rollback"); expect(await prisma.lesson.count({ where: { chapterId } })).toBe(1); expect(await prisma.vocabulary.count({ where: { lesson: { chapterId } } })).toBe(0); expect(await prisma.lessonBlock.count({ where: { lesson: { chapterId } } })).toBe(0); expect(await prisma.aiLessonImport.count({ where: { userId: admin.id } })).toBe(0);
});
it("returns the same receipt for sequential and simultaneous double submit", async () => {
  const p = await payload(); const results = await Promise.all([service.importAiLessonDraft(admin, p), service.importAiLessonDraft(admin, p)]); expect(results[0].lessonId).toBe(results[1].lessonId);
  expect((await service.importAiLessonDraft(admin, p)).replayed).toBe(true); expect(await prisma.lesson.count({ where: { chapterId } })).toBe(2); expect(await prisma.aiLessonImport.count({ where: { userId: admin.id } })).toBe(1);
});
it("rejects key reuse with changed data or another admin", async () => {
  const p = await payload(); await service.importAiLessonDraft(admin, p); p.draft.lesson.title = "Changed";
  const preview = await service.validateDraft(admin, p.draft, p.target); await expect(service.importAiLessonDraft(admin, { ...p, validationToken: preview.validationToken })).rejects.toThrow("yêu cầu khác");
  await expect(service.importAiLessonDraft({ ...admin, id: randomUUID() }, { ...p, draft: valid })).rejects.toThrow("yêu cầu khác");
});
it("appends without altering metadata, IDs, JSON extensions or legacy question/options", async () => {
  const block = await prisma.lessonBlock.create({ data: { lessonId, type: "TEXT", displayOrder: 9, content: { markdown: "Legacy", extension: { teacher: "keep" } } } });
  const ex = await prisma.exercise.create({ data: { lessonId, title: "Old", questions: { create: { type: "FILL_BLANK", prompt: "Old", correctAnswer: "아", content: undefined, options: { create: { text: "legacy", isCorrect: true } } } } }, include: { questions: { include: { options: true } } } });
  const before = await graph(lessonId); await service.importAiLessonDraft(admin, await payload({ mode: "APPEND", lessonId })); const after = await graph(lessonId);
  expect(after.title).toBe(before.title); expect(after.slug).toBe(before.slug); expect(after.blocks[0]).toEqual(block); expect(after.exercises.find((e) => e.id === ex.id)?.questions).toEqual(ex.questions); expect(after.learningObjectives[0]).toBe("Legacy objective"); expect(after.blocks.slice(1).map((b) => b.displayOrder)).toEqual([10, 11, 12, 13, 14]);
});
it("supports existing non-UUID lesson/chapter IDs from seed and legacy data", async () => {
  const legacyChapter = await prisma.chapter.create({ data: { id: `legacy-chapter-${randomUUID()}`, courseId, title: "Legacy IDs", slug: "legacy-ids" } });
  const legacyLesson = await prisma.lesson.create({ data: { id: `legacy-lesson-${randomUUID()}`, chapterId: legacyChapter.id, title: "Keep title", slug: `legacy-${randomUUID()}` } });
  const append = await service.importAiLessonDraft(admin, await payload({ mode: "APPEND", lessonId: legacyLesson.id })); expect(append.lessonId).toBe(legacyLesson.id); expect((await graph(legacyLesson.id)).title).toBe("Keep title");
  const created = await service.importAiLessonDraft(admin, await payload({ mode: "NEW", chapterId: legacyChapter.id })); expect((await graph(created.lessonId)).chapterId).toBe(legacyChapter.id);
});
it("replaces only an explicitly confirmed existing DRAFT and keeps sibling lessons", async () => {
  await prisma.lessonBlock.create({ data: { lessonId, type: "TEXT", content: { markdown: "Old" } } }); const sibling = await prisma.lesson.create({ data: { chapterId, title: "Sibling", slug: `sibling-${randomUUID()}` } });
  const p = await payload({ mode: "REPLACE", lessonId }); await expect(service.importAiLessonDraft(admin, { ...p, replaceConfirmed: false })).rejects.toThrow("xác nhận riêng");
  await service.importAiLessonDraft(admin, p); const stored = await graph(lessonId); expect(stored.title).toBe(p.draft.lesson.title); expect(stored.blocks).toHaveLength(5); expect(stored.blocks.some((b) => JSON.stringify(b.content).includes('"Old"'))).toBe(false); expect(await prisma.lesson.findUnique({ where: { id: sibling.id } })).toEqual(sibling);
});
it("rolls back a failed REPLACE including deleted legacy content and old metadata", async () => {
  await prisma.lessonBlock.create({ data: { lessonId, type: "TEXT", content: { markdown: "Preserve", customLegacy: true } } }); const before = await graph(lessonId);
  vi.spyOn(repo, "writeQuestions").mockRejectedValue(new Error("injected")); await expect(service.importAiLessonDraft(admin, await payload({ mode: "REPLACE", lessonId }))).rejects.toThrow("rollback"); expect(await graph(lessonId)).toEqual(before);
});
it("refuses stale REPLACE after another editor updates a child, and revalidation permits it", async () => {
  const block = await prisma.lessonBlock.create({ data: { lessonId, type: "TEXT", content: { markdown: "Before" } } });
  const p = await payload({ mode: "REPLACE", lessonId }); await prisma.lessonBlock.update({ where: { id: block.id }, data: { content: { markdown: "Another editor" }, updatedAt: new Date(Date.now() + 1000) } });
  const before = await graph(lessonId); await expect(service.importAiLessonDraft(admin, p)).rejects.toThrow("kiểm tra lại"); expect(await graph(lessonId)).toEqual(before);
  const fresh = await service.validateDraft(admin, p.draft, p.target); await service.importAiLessonDraft(admin, { ...p, validationToken: fresh.validationToken }); expect((await graph(lessonId)).blocks).toHaveLength(5);
});
it.each(["PUBLISHED", "ARCHIVED"] as const)("refuses APPEND/REPLACE against %s inside the transaction", async (status) => {
  await prisma.lesson.update({ where: { id: lessonId }, data: { status } }); const before = await graph(lessonId);
  for (const mode of ["APPEND", "REPLACE"] as const) await expect(service.importAiLessonDraft(admin, await payload({ mode, lessonId }))).rejects.toThrow("DRAFT"); expect(await graph(lessonId)).toEqual(before);
});
it("refuses REPLACE when learning history exists even after switching back to draft", async () => {
  const user = await prisma.user.create({ data: { id: randomUUID(), email: `${randomUUID()}@example.com`, name: "AI QA" } });
  try { await prisma.lessonProgress.create({ data: { userId: user.id, lessonId } }); await expect(service.importAiLessonDraft(admin, await payload({ mode: "REPLACE", lessonId }))).rejects.toThrow("dữ liệu học viên"); }
  finally { await prisma.user.delete({ where: { id: user.id } }); }
});
it.each(["attempt", "reviewCard"] as const)("keeps %s and its existing graph when REPLACE is requested", async (kind) => {
  const user = await prisma.user.create({ data: { id: randomUUID(), email: `${randomUUID()}@example.com`, name: "AI history QA" } });
  try {
    if (kind === "attempt") { const exercise = await prisma.exercise.create({ data: { lessonId, title: "History" } }); await prisma.exerciseAttempt.create({ data: { userId: user.id, exerciseId: exercise.id, submittedAt: new Date() } }); }
    else { const word = await prisma.vocabulary.create({ data: { lessonId, hangul: "아이", romanization: "ai", englishMeaning: "Child", vietnameseMeaning: "Em bé" } }); await prisma.reviewCard.create({ data: { userId: user.id, vocabularyId: word.id } }); }
    const before = await graph(lessonId); await expect(service.importAiLessonDraft(admin, await payload({ mode: "REPLACE", lessonId }))).rejects.toThrow("dữ liệu học viên"); expect(await graph(lessonId)).toEqual(before);
    expect(kind === "attempt" ? await prisma.exerciseAttempt.count({ where: { userId: user.id } }) : await prisma.reviewCard.count({ where: { userId: user.id } })).toBe(1);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
it("blocks knowledge-invalid drafts, stale previews and missing confirmation before any write", async () => {
  const p = await payload(); await expect(service.importAiLessonDraft(admin, { ...p, draft: invalidKnowledge })).rejects.toThrow("còn lỗi");
  p.draft.lesson.title = "Edit after validation"; await expect(service.importAiLessonDraft(admin, p)).rejects.toThrow("kiểm tra lại"); await expect(service.importAiLessonDraft(admin, { ...p, confirmed: false })).rejects.toThrow(); expect(await prisma.lesson.count({ where: { chapterId } })).toBe(1);
});
it("reports duplicate slug without partial persistence", async () => {
  const p = await payload(); p.draft.lesson.slug = (await graph(lessonId)).slug; const preview = await service.validateDraft(admin, p.draft, p.target);
  await expect(service.importAiLessonDraft(admin, { ...p, validationToken: preview.validationToken })).rejects.toThrow("Slug"); expect(await prisma.lesson.count({ where: { chapterId } })).toBe(1);
});
it("rejects forged/user-mismatched tokens and expires unsigned previews", async () => {
  const p = await payload(); const hash = aiImportHash(p.draft, p.target); expect(() => verifyAiValidationToken(`${p.validationToken}x`, admin.id, hash)).toThrow(); expect(() => verifyAiValidationToken(p.validationToken, randomUUID(), hash)).toThrow();
  const token = issueAiValidationToken(admin.id, hash); vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000); expect(() => verifyAiValidationToken(token, admin.id, hash)).toThrow();
});
it("recovers an already committed import using its receipt after preview expiry", async () => {
  const p = await payload(); const result = await service.importAiLessonDraft(admin, p); vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000); expect((await service.importAiLessonDraft(admin, p)).lessonId).toBe(result.lessonId);
});
it("allows warning-only drafts and rejects non-admin generation/import", async () => {
  const p = await payload(); expect((await service.validateDraft(admin, p.draft, p.target)).validation.warnings.length).toBeGreaterThan(0); await service.importAiLessonDraft(admin, p);
  await expect(service.generateDraft({ ...admin, role: "STUDENT" }, input, p.target)).rejects.toThrow("quyền"); await expect(service.importAiLessonDraft({ ...admin, role: "STUDENT" }, p)).rejects.toThrow("quyền");
});
