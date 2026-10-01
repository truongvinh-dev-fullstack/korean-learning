import "dotenv/config";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/shared/db/prisma";
import { lessonAccessService } from "@/modules/lessons/lesson-access.service";
import { lessonService } from "@/modules/lessons/lesson.service";
import { progressRepository } from "@/modules/progress/progress.repository";
import { progressService } from "@/modules/progress/progress.service";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors/domain-errors";
import { getVietnamDateString } from "@/shared/utils/date";

const courseId = "c0000000-0000-4000-a000-000000000001";
const firstId = "l0000000-0000-4000-a000-000000000001";
const secondId = "l0000000-0000-4000-a000-000000000002";
const firstSlug = "bai-1-nguyen-am-co-ban";
const secondSlug = "bai-2-phu-am-co-ban";

describe("Batch 3 lesson access and progress", () => {
  const users: string[] = [];
  async function learner() {
    const id = crypto.randomUUID();
    await prisma.user.create({ data: { id, email: `batch3-${id}@example.com`, name: "Batch 3 learner" } });
    users.push(id);
    return id;
  }
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
  });

  it("returns one typed decision and never loads protected content for denied readers", async () => {
    const id = await learner();
    expect((await lessonAccessService.resolveBySlug(null, firstSlug)).kind).toBe("UNAUTHENTICATED");
    expect((await lessonAccessService.resolveBySlug(id, firstSlug)).kind).toBe("NOT_ENROLLED");
    await expect(lessonService.getPublishedLessonBySlug(firstSlug, null)).rejects.toThrow(UnauthorizedError);
    await expect(lessonService.getPublishedLessonBySlug(firstSlug, id)).rejects.toThrow(ForbiddenError);
    await prisma.enrollment.create({ data: { userId: id, courseId } });
    const locked = await lessonAccessService.resolveBySlug(id, secondSlug);
    expect(locked.kind).toBe("LOCKED_BY_PREVIOUS_LESSON");
    if (locked.kind === "LOCKED_BY_PREVIOUS_LESSON") expect(locked.requiredLesson.id).toBe(firstId);
    await expect(lessonService.getPublishedLessonWithNavigation(secondSlug, id)).rejects.toThrow(ForbiddenError);
    expect((await lessonAccessService.resolveBySlug(id, firstSlug)).kind).toBe("AVAILABLE");
    expect((await lessonService.getPublishedLessonBySlug(firstSlug, id))?.blocks.length).toBeGreaterThan(0);
    await prisma.lessonProgress.create({ data: { userId: id, lessonId: firstId, status: "COMPLETED", completedAt: new Date() } });
    expect((await lessonAccessService.resolveById(id, secondId)).kind).toBe("AVAILABLE");
    expect((await lessonAccessService.resolveBySlug(id, "bai-4-cac-cau-chao-hoi-thong-dung")).kind).toBe("NOT_FOUND");
  });

  it("rolls back completion when card enqueue fails, then repairs missing cards on retry", async () => {
    const id = await learner();
    await prisma.enrollment.create({ data: { userId: id, courseId } });
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { lessonId: firstId, status: "PUBLISHED" } });
    await prisma.exerciseAttempt.create({ data: { userId: id, exerciseId: exercise.id, score: 40, maxScore: 40, percentage: 100, isPassing: true, submittedAt: new Date() } });
    const now = new Date();
    await expect(progressRepository.completeLessonTransaction({
      userId: id, lessonId: firstId, courseId, score: 100, now, vietnamDate: getVietnamDateString(now),
      enqueueVocabulary: async () => { throw new Error("enqueue failed"); },
    })).rejects.toThrow("enqueue failed");
    expect(await prisma.lessonProgress.count({ where: { userId: id, lessonId: firstId } })).toBe(0);
    expect(await prisma.dailyStudyStat.count({ where: { userId: id } })).toBe(0);

    const request = () => progressService.completeLesson({ requestingUserId: id, targetUserId: id, lessonId: firstId });
    await request();
    const vocabularyCount = await prisma.vocabulary.count({ where: { lessonId: firstId } });
    expect(await prisma.reviewCard.count({ where: { userId: id } })).toBe(vocabularyCount);
    await prisma.reviewCard.deleteMany({ where: { userId: id } });
    await request();
    expect(await prisma.reviewCard.count({ where: { userId: id } })).toBe(vocabularyCount);
    expect((await prisma.dailyStudyStat.findUniqueOrThrow({ where: { userId_date: { userId: id, date: getVietnamDateString() } } })).lessonsCompleted).toBe(1);
  });

  it("all published seed audio references resolve to local OGG files", async () => {
    const lessons = await prisma.lesson.findMany({
      where: { status: "PUBLISHED", chapter: { status: "PUBLISHED", course: { status: "PUBLISHED" } } },
      include: { blocks: true, vocabularies: true, exercises: { where: { status: "PUBLISHED" }, include: { questions: true } } },
    });
    const urls: string[] = [];
    function collect(value: unknown) {
      if (Array.isArray(value)) return value.forEach(collect);
      if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
        if (key === "audioUrl" && typeof child === "string") urls.push(child);
        else collect(child);
      }
    }
    for (const lesson of lessons) {
      for (const block of lesson.blocks) collect(block.content);
      for (const vocabulary of lesson.vocabularies) if (vocabulary.audioUrl) urls.push(vocabulary.audioUrl);
      for (const exercise of lesson.exercises) for (const question of exercise.questions) if (question.audioUrl) urls.push(question.audioUrl);
    }
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const url of urls) {
      expect(url).toMatch(/^\/audio\/[a-z0-9/-]+\.ogg$/);
      const path = join(process.cwd(), "public", url.slice(1));
      expect(existsSync(path), url).toBe(true);
      expect(readFileSync(path).subarray(0, 4).toString()).toBe("OggS");
    }
  });
});
