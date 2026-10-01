import { ContentStatus, LessonProgressStatus } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

export class LessonAccessRepository {
  findPublishedLessonBySlug(slug: string) {
    return prisma.lesson.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, chapter: { status: ContentStatus.PUBLISHED, course: { status: ContentStatus.PUBLISHED } } },
      select: { id: true, slug: true, title: true, summary: true, chapter: { select: { courseId: true, course: { select: { slug: true, title: true } } } } },
    });
  }

  findPublishedLesson(lessonId: string) {
    return prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: ContentStatus.PUBLISHED,
        chapter: {
          status: ContentStatus.PUBLISHED,
          course: { status: ContentStatus.PUBLISHED },
        },
      },
      select: { id: true, slug: true, title: true, summary: true, chapter: { select: { courseId: true, course: { select: { slug: true, title: true } } } } },
    });
  }

  findEnrollment(userId: string, courseId: string) {
    return prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
  }

  findOrderedPublishedLessons(courseId: string) {
    return prisma.lesson.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        chapter: { courseId, status: ContentStatus.PUBLISHED },
      },
      orderBy: [{ chapter: { displayOrder: "asc" } }, { displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, slug: true, title: true },
    });
  }

  findCompletedLessons(userId: string, lessonIds: string[]) {
    return prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds }, status: LessonProgressStatus.COMPLETED },
      select: { lessonId: true },
    });
  }
}

export const lessonAccessRepository = new LessonAccessRepository();
