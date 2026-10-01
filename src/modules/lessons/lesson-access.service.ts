import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/shared/errors/domain-errors";
import { lessonAccessRepository, LessonAccessRepository } from "./lesson-access.repository";

/** One decision for lesson pages, student exercises, and progress writes. */
export class LessonAccessService {
  constructor(private readonly repo: LessonAccessRepository = lessonAccessRepository) {}

  async resolveBySlug(userId: string | null | undefined, slug: string) {
    return this.resolve(userId, await this.repo.findPublishedLessonBySlug(slug));
  }

  async resolveById(userId: string | null | undefined, lessonId: string) {
    return this.resolve(userId, await this.repo.findPublishedLesson(lessonId));
  }

  private async resolve(
    userId: string | null | undefined,
    lesson: Awaited<ReturnType<LessonAccessRepository["findPublishedLesson"]>>
  ) {
    if (!lesson) return { kind: "NOT_FOUND" as const };
    if (!userId) return { kind: "UNAUTHENTICATED" as const, lesson };
    const courseId = lesson.chapter.courseId;
    const enrollment = await this.repo.findEnrollment(userId, courseId);
    if (!enrollment) return { kind: "NOT_ENROLLED" as const, lesson };
    const orderedLessons = await this.repo.findOrderedPublishedLessons(courseId);
    const index = orderedLessons.findIndex((item) => item.id === lesson.id);
    if (index < 0) return { kind: "NOT_FOUND" as const };
    const preceding = orderedLessons.slice(0, index);
    const completed = await this.repo.findCompletedLessons(userId, preceding.map((item) => item.id));
    const completedIds = new Set(completed.map((item) => item.lessonId));
    const requiredLesson = preceding.find((item) => !completedIds.has(item.id));
    if (requiredLesson) return { kind: "LOCKED_BY_PREVIOUS_LESSON" as const, lesson, requiredLesson };
    return { kind: "AVAILABLE" as const, lesson };
  }

  async requireAccess(userId: string, lessonId: string) {
    const decision = await this.resolveById(userId, lessonId);
    if (decision.kind === "NOT_FOUND") throw new NotFoundError("Bài học chưa được công khai.");
    if (decision.kind === "UNAUTHENTICATED") throw new UnauthorizedError();
    if (decision.kind === "NOT_ENROLLED") throw new ForbiddenError("Bạn cần ghi danh khóa học trước khi học bài này.");
    if (decision.kind === "LOCKED_BY_PREVIOUS_LESSON") throw new ForbiddenError("Bạn cần hoàn thành các bài học trước đó.");
    return { lessonId, courseId: decision.lesson.chapter.courseId };
  }
}

export const lessonAccessService = new LessonAccessService();
