import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { CardState, ContentStatus, ReviewRating } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { progressService } from "@/modules/progress/progress.service";
import { adminService } from "@/modules/admin/admin.service";
import { ConflictError, ForbiddenError } from "@/shared/errors/domain-errors";

const admin = { role: "ADMIN" };
const courseIds: string[] = [];
const userIds: string[] = [];

async function fixture(status: ContentStatus = ContentStatus.PUBLISHED) {
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const lessonId = randomUUID();
  const userId = randomUUID();
  courseIds.push(courseId);
  userIds.push(userId);
  await prisma.course.create({ data: { id: courseId, slug: `p1-${courseId}`, title: "P1 course", description: "P1 test", status } });
  await prisma.chapter.create({ data: { id: chapterId, courseId, slug: `p1-${chapterId}`, title: "P1 chapter", status } });
  await prisma.lesson.create({ data: { id: lessonId, chapterId, slug: `p1-${lessonId}`, title: "P1 lesson", status } });
  await prisma.user.create({ data: { id: userId, email: `p1-${userId}@example.com`, name: "P1 learner", role: "STUDENT" } });
  return { courseId, chapterId, lessonId, userId };
}

afterEach(async () => {
  for (const id of courseIds.splice(0)) {
    if (await prisma.course.findUnique({ where: { id }, select: { id: true } })) {
      await prisma.course.delete({ where: { id } });
    }
  }
  for (const id of userIds.splice(0)) {
    await prisma.user.delete({ where: { id } });
  }
});

describe("P1 lesson and deletion rules", () => {
  it("allows an exercise-free lesson only after enrollment, valid start and sequence", async () => {
    const { courseId, chapterId, lessonId, userId } = await fixture();
    const nextLessonId = randomUUID();
    await prisma.lesson.create({ data: { id: nextLessonId, chapterId, slug: `p1-${nextLessonId}`, title: "Next lesson", displayOrder: 1, status: ContentStatus.PUBLISHED } });
    const complete = (id: string) => progressService.completeLesson({ requestingUserId: userId, targetUserId: userId, lessonId: id });
    const start = (id: string) => progressService.startLesson({ requestingUserId: userId, targetUserId: userId, lessonId: id });
    await expect(start(lessonId)).rejects.toThrow(ForbiddenError);
    await expect(complete(lessonId)).rejects.toThrow(ForbiddenError);
    await prisma.enrollment.create({ data: { userId, courseId } });
    await expect(complete(lessonId)).rejects.toThrow(ConflictError);
    await expect(start(nextLessonId)).rejects.toThrow(ForbiddenError);
    await start(lessonId);
    expect((await complete(lessonId)).score).toBe(100);
    await start(nextLessonId);
    expect((await complete(nextLessonId)).status).toBe("COMPLETED");
  });

  it.each(["enrollment", "progress", "attempt", "review card", "review log"] as const)(
    "blocks course deletion when %s exists",
    async (kind) => {
      const { courseId, lessonId, userId } = await fixture();
      if (kind === "enrollment") await prisma.enrollment.create({ data: { userId, courseId } });
      if (kind === "progress") await prisma.lessonProgress.create({ data: { userId, lessonId, status: "COMPLETED" } });
      if (kind === "attempt") {
        const exercise = await prisma.exercise.create({ data: { lessonId, title: "P1 quiz", status: "PUBLISHED" } });
        await prisma.exerciseAttempt.create({ data: { userId, exerciseId: exercise.id, submittedAt: new Date() } });
      }
      if (kind === "review card" || kind === "review log") {
        const vocabulary = await prisma.vocabulary.create({ data: { lessonId, hangul: "가", romanization: "ga", englishMeaning: "go", vietnameseMeaning: "đi" } });
        const card = await prisma.reviewCard.create({ data: { userId, vocabularyId: vocabulary.id } });
        if (kind === "review log") {
          await prisma.reviewLog.create({ data: {
            cardId: card.id, userId, rating: ReviewRating.GOOD,
            intervalBefore: 0, intervalAfter: 1, easeFactorBefore: 2.5, easeFactorAfter: 2.5,
            repetitionsBefore: 0, repetitionsAfter: 1, stateBefore: CardState.NEW, stateAfter: CardState.REVIEW,
          } });
        }
      }
      await expect(adminService.deleteCourse(admin, courseId)).rejects.toThrow(ConflictError);
      expect(await prisma.course.findUnique({ where: { id: courseId } })).not.toBeNull();
    }
  );

  it("blocks chapter deletion for an attempt without progress", async () => {
    const { chapterId, lessonId, userId } = await fixture();
    const exercise = await prisma.exercise.create({ data: { lessonId, title: "P1 quiz", status: "PUBLISHED" } });
    await prisma.exerciseAttempt.create({ data: { userId, exerciseId: exercise.id, submittedAt: new Date() } });
    expect(await prisma.lessonProgress.count({ where: { userId, lessonId } })).toBe(0);
    await expect(adminService.deleteChapter(admin, chapterId)).rejects.toThrow(ConflictError);
  });

  it("still permits deletion of draft content without learner records", async () => {
    const { courseId, chapterId } = await fixture(ContentStatus.DRAFT);
    await adminService.deleteChapter(admin, chapterId);
    expect(await prisma.chapter.findUnique({ where: { id: chapterId } })).toBeNull();
    await adminService.deleteCourse(admin, courseId);
    expect(await prisma.course.findUnique({ where: { id: courseId } })).toBeNull();
  });

  it("keeps seed lessons 4–8 in draft and counts only three published lessons", async () => {
    const seedCourse = await prisma.course.findUniqueOrThrow({ where: { slug: "tieng-han-tu-con-so-0" } });
    const published = await prisma.lesson.count({ where: { chapter: { courseId: seedCourse.id }, status: ContentStatus.PUBLISHED } });
    expect(published).toBe(3);
    for (let number = 4; number <= 8; number++) {
      const id = `l0000000-0000-4000-a000-${String(number).padStart(12, "0")}`;
      expect((await prisma.lesson.findUniqueOrThrow({ where: { id } })).status).toBe(ContentStatus.DRAFT);
    }
  });
});
