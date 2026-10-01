import { prisma } from "@/shared/db/prisma";
import { ContentStatus } from "@prisma/client";

export class CourseRepository {
  /**
   * Retrieves all published courses ordered by displayOrder.
   */
  async findPublishedCourses() {
    return prisma.course.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
      },
      orderBy: {
        displayOrder: "asc",
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        level: true,
        status: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        chapters: {
          where: { status: ContentStatus.PUBLISHED },
          select: {
            id: true,
            lessons: {
              where: { status: ContentStatus.PUBLISHED },
              select: { estimatedMinutes: true },
            },
          },
        },
      },
    });
  }

  /**
   * Finds a published course by slug with ordered chapters and ordered lessons.
   */
  async findPublishedCourseBySlug(slug: string) {
    return prisma.course.findFirst({
      where: {
        slug,
        status: ContentStatus.PUBLISHED,
      },
      include: {
        chapters: {
          where: { status: ContentStatus.PUBLISHED },
          orderBy: { displayOrder: "asc" },
          include: {
            lessons: {
              where: { status: ContentStatus.PUBLISHED },
              orderBy: { displayOrder: "asc" },
              select: {
                id: true,
                slug: true,
                title: true,
                summary: true,
                estimatedMinutes: true,
                displayOrder: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Finds a published course by ID.
   */
  async findPublishedCourseById(id: string) {
    return prisma.course.findFirst({
      where: {
        id,
        status: ContentStatus.PUBLISHED,
      },
    });
  }

  /**
   * Finds an enrollment record for a specific user and course.
   */
  async findEnrollment(userId: string, courseId: string) {
    return prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });
  }

  /**
   * Creates a new enrollment record.
   */
  async createEnrollment(userId: string, courseId: string) {
    return prisma.enrollment.create({
      data: {
        userId,
        courseId,
      },
    });
  }

  /**
   * Finds all enrollments for a student.
   */
  async findUserEnrollments(userId: string) {
    return prisma.enrollment.findMany({
      where: {
        userId,
        course: {
          status: ContentStatus.PUBLISHED,
        },
      },
      include: {
        course: {
          include: {
            chapters: {
              where: { status: ContentStatus.PUBLISHED },
              include: {
                lessons: {
                  where: { status: ContentStatus.PUBLISHED },
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    displayOrder: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        enrolledAt: "desc",
      },
    });
  }

  /**
   * Marks an enrollment completed.
   */
  async updateEnrollmentCompletedAt(userId: string, courseId: string, completedAt: Date) {
    return prisma.enrollment.update({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      data: {
        completedAt,
      },
    });
  }
}

export const courseRepository = new CourseRepository();
