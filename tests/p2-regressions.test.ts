import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentStatus } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { exerciseService } from "@/modules/exercises/exercise.service";
import { NotFoundError, ConflictError } from "@/shared/errors/domain-errors";
import { handleAdminError } from "@/shared/auth/admin-guard";
import { unexpectedHttpError } from "@/shared/errors/http-error";

const courses: string[] = [];
const users: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
  await prisma.course.deleteMany({ where: { id: { in: courses.splice(0) } } });
});

describe("P2 publication and HTTP boundaries", () => {
  it.each(["exercise", "lesson", "chapter", "course"] as const)(
    "rejects retrieval and submission when %s is a draft",
    async (draft) => {
      const courseId = randomUUID(), chapterId = randomUUID(), lessonId = randomUUID(), exerciseId = randomUUID(), userId = randomUUID();
      courses.push(courseId); users.push(userId);
      const status = (kind: typeof draft) => draft === kind ? ContentStatus.DRAFT : ContentStatus.PUBLISHED;
      await prisma.course.create({ data: { id: courseId, slug: `p2-${courseId}`, title: "P2 course", description: "P2", status: status("course") } });
      await prisma.chapter.create({ data: { id: chapterId, courseId, slug: `p2-${chapterId}`, title: "P2 chapter", status: status("chapter") } });
      await prisma.lesson.create({ data: { id: lessonId, chapterId, slug: `p2-${lessonId}`, title: "P2 lesson", status: status("lesson") } });
      await prisma.exercise.create({ data: { id: exerciseId, lessonId, title: "P2 quiz", status: status("exercise") } });
      await prisma.user.create({ data: { id: userId, email: `p2-${userId}@example.com`, name: "P2 student" } });
      await prisma.enrollment.create({ data: { courseId, userId } });
      expect(await exerciseService.getExerciseForStudent(exerciseId, userId)).toBeNull();
      await expect(exerciseService.submitAttempt({ userId, exerciseId, answers: [] })).rejects.toThrow(NotFoundError);
      expect(await prisma.exerciseAttempt.count({ where: { userId } })).toBe(0);
    }
  );

  it("hides unexpected exception details while preserving domain conflicts", async () => {
    const diagnostic = "private-database-detail";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const unexpected = await unexpectedHttpError(new Error(diagnostic)).json();
      expect(JSON.stringify(unexpected)).not.toContain(diagnostic);
      expect(log).toHaveBeenCalled();
      const adminUnexpected = handleAdminError(new Error(diagnostic));
      expect(adminUnexpected.status).toBe(500);
      expect(JSON.stringify(await adminUnexpected.json())).not.toContain(diagnostic);
      const conflict = handleAdminError(new ConflictError("Không thể xóa dữ liệu đang sử dụng."));
      expect(conflict.status).toBe(409);
      expect((await conflict.json()).error.message).toBe("Không thể xóa dữ liệu đang sử dụng.");
    } finally {
      log.mockRestore();
    }
  });

  it("uses a database dedicated to tests", () => {
    expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/_test$/);
  });
});
