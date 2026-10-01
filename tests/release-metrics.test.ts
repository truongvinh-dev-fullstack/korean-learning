import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/prisma";
import { DashboardService } from "@/modules/dashboard/dashboard.service";
import { CourseService } from "@/modules/courses/course.service";
import { progressService } from "@/modules/progress/progress.service";
import { srsService } from "@/modules/srs/srs.service";
import { srsRepository } from "@/modules/srs/srs.repository";

let courseId: string, lessonId: string, user: { id: string; name: string; email: string };
// Other integration files create/delete published courses concurrently. Limit this
// metric scenario to its own catalog fixture while keeping real progress/card reads.
class FixtureCourses extends CourseService {
  override async getPublishedCatalog() {
    return (await super.getPublishedCatalog()).filter((course) => course.id === courseId);
  }
}
const dashboardService = new DashboardService(new FixtureCourses());
beforeEach(async () => {
  const id = randomUUID();
  user = await prisma.user.create({ data: { id, email: `rc-metric-${id}@example.com`, name: "RC learner" } });
  courseId = randomUUID();
  const course = await prisma.course.create({ data: {
    id: courseId, slug: `rc-${courseId}`, title: "RC", description: "RC", status: "PUBLISHED",
    chapters: { create: { slug: `rc-${randomUUID()}`, title: "RC", status: "PUBLISHED", lessons: { create: { slug: `rc-${randomUUID()}`, title: "RC", status: "PUBLISHED" } } } },
  }, include: { chapters: { include: { lessons: true } } } });
  lessonId = course.chapters[0].lessons[0].id;
  await prisma.enrollment.create({ data: { userId: user.id, courseId } });
});
afterEach(async () => {
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.course.delete({ where: { id: courseId } });
});
describe("F8 factual vocabulary metrics", () => {
  it("reports zero for zero completed lessons and zero cards", async () => {
    expect((await dashboardService.getStudentDashboardData(user)).metrics.totalWordsLearned).toBe(0);
  });
  it("completes a vocabulary-free lesson without inventing words", async () => {
    const request = { requestingUserId: user.id, targetUserId: user.id, lessonId };
    await progressService.startLesson(request);
    await progressService.completeLesson(request);
    const { metrics } = await dashboardService.getStudentDashboardData(user);
    expect(metrics.completedLessonsCount).toBe(1);
    expect(metrics.totalWordsLearned).toBe(0);
  });
  it("counts actual distinct vocabulary cards and ignores duplicate enqueue requests", async () => {
    for (const hangul of ["물", "사과"]) await prisma.vocabulary.create({ data: {
      lessonId, hangul, romanization: "word", vietnameseMeaning: "Từ", englishMeaning: "Word",
    } });
    await srsService.enqueueLessonVocabulary(user.id, lessonId);
    await srsService.enqueueLessonVocabulary(user.id, lessonId);
    const cards = await prisma.reviewCard.findMany({ where: { userId: user.id } });
    await srsRepository.createReviewCards([{ userId: user.id, vocabularyId: cards[0].vocabularyId }, { userId: user.id, vocabularyId: cards[0].vocabularyId }]);
    expect(cards).toHaveLength(2);
    expect((await dashboardService.getStudentDashboardData(user)).metrics.totalWordsLearned).toBe(2);
  });
});
