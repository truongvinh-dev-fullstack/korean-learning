import { courseRepository, CourseRepository } from "./course.repository";
import {
  UnauthorizedError,
  NotFoundError,
  DuplicateEnrollmentError,
} from "@/shared/errors/domain-errors";

export class CourseService {
  constructor(private readonly repo: CourseRepository = courseRepository) {}

  /**
   * Retrieves published courses formatted for catalog display with aggregated metrics.
   */
  async getPublishedCatalog() {
    const courses = await this.repo.findPublishedCourses();

    return courses.map((course) => {
      const chapterCount = course.chapters.length;
      const lessonCount = course.chapters.reduce(
        (total, chapter) => total + chapter.lessons.length,
        0
      );
      const estimatedMinutes = course.chapters.reduce(
        (total, chapter) => total + chapter.lessons.reduce((minutes, lesson) => minutes + lesson.estimatedMinutes, 0),
        0
      );

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        level: course.level,
        status: course.status,
        displayOrder: course.displayOrder,
        chapterCount,
        lessonCount,
        estimatedMinutes,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      };
    });
  }

  /**
   * Retrieves a course and its full ordered syllabus by slug.
   */
  async getCourseBySlug(slug: string) {
    const course = await this.repo.findPublishedCourseBySlug(slug);
    if (!course) {
      return null;
    }

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      level: course.level,
      status: course.status,
      displayOrder: course.displayOrder,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      chapters: course.chapters.map((chapter) => ({
        id: chapter.id,
        slug: chapter.slug,
        title: chapter.title,
        description: chapter.description,
        displayOrder: chapter.displayOrder,
        lessons: chapter.lessons,
      })),
    };
  }

  /**
   * Enrolls an authenticated student in a published course.
   * Enforces business rules:
   * - user must be authenticated
   * - course must exist and be published
   * - one enrollment per user and course (rejects duplicate enrollment)
   */
  async enrollStudent(userId: string, courseId: string) {
    if (!userId || typeof userId !== "string") {
      throw new UnauthorizedError("Yêu cầu đăng nhập để đăng ký khóa học.");
    }

    const course = await this.repo.findPublishedCourseById(courseId);
    if (!course) {
      throw new NotFoundError("Không tìm thấy khóa học công khai tương ứng.");
    }

    const existing = await this.repo.findEnrollment(userId, courseId);
    if (existing) {
      throw new DuplicateEnrollmentError("Học viên đã đăng ký khóa học này rồi.");
    }

    return this.repo.createEnrollment(userId, courseId);
  }

  /**
   * Checks if a user is enrolled in a course.
   */
  async isStudentEnrolled(userId: string, courseId: string): Promise<boolean> {
    if (!userId) return false;
    const enrollment = await this.repo.findEnrollment(userId, courseId);
    return Boolean(enrollment);
  }

  /**
   * Retrieves enrollments for a user.
   */
  async getUserEnrollments(userId: string) {
    if (!userId) return [];
    return this.repo.findUserEnrollments(userId);
  }
}

export const courseService = new CourseService();
