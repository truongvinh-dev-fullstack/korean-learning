import { progressRepository, ProgressRepository } from "./progress.repository";
import { lessonRepository, LessonRepository } from "@/modules/lessons/lesson.repository";
import { courseRepository, CourseRepository } from "@/modules/courses/course.repository";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ContentNotPublishedError,
  ConflictError,
} from "@/shared/errors/domain-errors";
import { getVietnamDateString, calculateStreak } from "@/shared/utils/date";
import { LessonProgressStatus } from "@prisma/client";
import { CourseProgressData, UserStreakData } from "./progress.types";
import { srsService } from "@/modules/srs/srs.service";
import { lessonAccessService } from "@/modules/lessons/lesson-access.service";

export class ProgressService {
  constructor(
    private readonly repo: ProgressRepository = progressRepository,
    private readonly lessonRepo: LessonRepository = lessonRepository,
    private readonly courseRepo: CourseRepository = courseRepository
  ) {}

  /**
   * Asserts that the authenticated user is only modifying their own progress records.
   */
  assertUserOwnsProgress(requestingUserId?: string | null, targetUserId?: string | null) {
    if (!requestingUserId) {
      throw new UnauthorizedError("Yêu cầu đăng nhập để ghi nhận tiến độ.");
    }
    if (requestingUserId !== targetUserId) {
      throw new ForbiddenError(
        "Bạn không có quyền cập nhật tiến độ học tập của người dùng khác."
      );
    }
  }

  /**
   * Starts a lesson idempotently.
   * Only published lessons can be started.
   */
  async startLesson({
    requestingUserId,
    targetUserId,
    lessonId,
  }: {
    requestingUserId: string;
    targetUserId: string;
    lessonId: string;
  }) {
    this.assertUserOwnsProgress(requestingUserId, targetUserId);
    await lessonAccessService.requireAccess(targetUserId, lessonId);

    const lesson = await this.lessonRepo.findPublishedLessonById(lessonId);
    if (!lesson) {
      throw new NotFoundError(
        "Không tìm thấy bài học hoặc bài học chưa được công khai."
      );
    }

    const now = new Date();
    return this.repo.startLessonProgress(targetUserId, lessonId, now);
  }

  /**
   * Completes a lesson idempotently.
   * If already completed, returns existing record without repeating streak or stat increments.
   */
  async completeLesson({
    requestingUserId,
    targetUserId,
    lessonId,
  }: {
    requestingUserId: string;
    targetUserId: string;
    lessonId: string;
  }) {
    this.assertUserOwnsProgress(requestingUserId, targetUserId);
    await lessonAccessService.requireAccess(targetUserId, lessonId);

    const lesson = await this.lessonRepo.findPublishedLessonById(lessonId);
    if (!lesson) {
      throw new ContentNotPublishedError(
        "Không tìm thấy bài học hoặc bài học chưa được công khai."
      );
    }

    const existing = await this.repo.findLessonProgress(targetUserId, lessonId);
    const exerciseIds = await this.repo.findPublishedExerciseIds(lessonId);
    let score = 100;
    if (exerciseIds.length > 0) {
      const passingAttempt = await this.repo.findBestPassingAttempt(targetUserId, exerciseIds);
      if (!passingAttempt) {
        throw new ConflictError("Bạn cần đạt bài tập trước khi hoàn thành bài học.");
      }
      score = passingAttempt.percentage;
    } else if (!existing || (existing.status !== LessonProgressStatus.IN_PROGRESS && existing.status !== LessonProgressStatus.COMPLETED)) {
      throw new ConflictError("Bạn cần bắt đầu bài học trước khi hoàn thành.");
    }

    const now = new Date();
    const vietnamDate = getVietnamDateString(now);

    const progress = await this.repo.completeLessonTransaction({
      userId: targetUserId,
      lessonId,
      courseId: lesson.chapter.course.id,
      score,
      now,
      vietnamDate,
      enqueueVocabulary: (tx) => srsService.enqueueLessonVocabularyInTransaction(targetUserId, lessonId, tx),
    });

    return progress;
  }

  /**
   * Retrieves user's continuous daily study streak deterministically.
   */
  async getUserStreak(userId: string, referenceDate: Date = new Date()): Promise<UserStreakData> {
    if (!userId) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        studiedToday: false,
      };
    }

    const dailyStats = await this.repo.findUserDailyStudyStats(userId);
    const activeDates = dailyStats.map((s) => s.date);

    return calculateStreak(activeDates, referenceDate);
  }

  /**
   * Calculates actual progress percentage and next uncompleted lesson for a course.
   */
  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgressData> {
    const course = await this.courseRepo.findPublishedCourseById(courseId);
    if (!course) {
      throw new NotFoundError("Không tìm thấy khóa học công khai.");
    }

    const orderedLessons = await this.lessonRepo.findOrderedLessonsForCourse(courseId);
    const userProgresses = await this.repo.findUserProgressForCourse(userId, courseId);

    const completedLessonIds = new Set(
      userProgresses
        .filter((p) => p.status === LessonProgressStatus.COMPLETED)
        .map((p) => p.lessonId)
    );

    const totalLessons = orderedLessons.length;
    const completedLessons = completedLessonIds.size;
    const progressPercentage =
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    const isCompleted = totalLessons > 0 && completedLessons >= totalLessons;

    // Next lesson is the first lesson in curriculum order not yet completed
    const nextLessonCandidate = orderedLessons.find((l) => !completedLessonIds.has(l.id));

    const nextLesson = nextLessonCandidate
      ? {
          id: nextLessonCandidate.id,
          slug: nextLessonCandidate.slug,
          title: nextLessonCandidate.title,
          chapterTitle: nextLessonCandidate.chapter.title,
        }
      : null;

    return {
      courseId,
      totalLessons,
      completedLessons,
      progressPercentage,
      isCompleted,
      nextLesson,
    };
  }

  /**
   * Retrieves lesson progress status for a specific user and lesson.
   */
  async getLessonStatus(userId: string, lessonId: string) {
    if (!userId) return LessonProgressStatus.NOT_STARTED;
    const progress = await this.repo.findLessonProgress(userId, lessonId);
    return progress?.status || LessonProgressStatus.NOT_STARTED;
  }
}

export const progressService = new ProgressService();
