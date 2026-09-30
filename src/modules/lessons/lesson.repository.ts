import { prisma } from "@/shared/db/prisma";
import { ContentStatus } from "@prisma/client";

export class LessonRepository {
  /**
   * Finds a published lesson by slug with its blocks, vocabularies, and chapter/course context.
   */
  async findPublishedLessonBySlug(slug: string) {
    return prisma.lesson.findFirst({
      where: {
        slug,
        status: ContentStatus.PUBLISHED,
        chapter: {
          status: ContentStatus.PUBLISHED,
          course: {
            status: ContentStatus.PUBLISHED,
          },
        },
      },
      include: {
        blocks: {
          orderBy: { displayOrder: "asc" },
        },
        vocabularies: {
          orderBy: { displayOrder: "asc" },
        },
        chapter: {
          select: {
            id: true,
            slug: true,
            title: true,
            displayOrder: true,
            course: {
              select: {
                id: true,
                slug: true,
                title: true,
              },
            },
          },
        },
        exercises: {
          where: { status: ContentStatus.PUBLISHED },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            displayOrder: true,
            _count: {
              select: { questions: true },
            },
          },
        },
      },
    });
  }

  /**
   * Finds all published lessons in a course ordered by chapter and lesson display order.
   */
  async findOrderedLessonsForCourse(courseId: string) {
    return prisma.lesson.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        chapter: {
          courseId,
          status: ContentStatus.PUBLISHED,
        },
      },
      orderBy: [
        { chapter: { displayOrder: "asc" } },
        { displayOrder: "asc" },
      ],
      select: {
        id: true,
        slug: true,
        title: true,
        chapterId: true,
        displayOrder: true,
        chapter: {
          select: {
            id: true,
            title: true,
            displayOrder: true,
          },
        },
      },
    });
  }

  /**
   * Finds a published lesson by ID with chapter and course context.
   */
  async findPublishedLessonById(id: string) {
    return prisma.lesson.findFirst({
      where: {
        id,
        status: ContentStatus.PUBLISHED,
        chapter: {
          status: ContentStatus.PUBLISHED,
          course: {
            status: ContentStatus.PUBLISHED,
          },
        },
      },
      include: {
        chapter: {
          select: {
            id: true,
            courseId: true,
            course: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
  }
}

export const lessonRepository = new LessonRepository();
