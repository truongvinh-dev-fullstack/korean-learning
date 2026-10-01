import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/shared/db/prisma";
import { courseService } from "@/modules/courses/course.service";
import { progressService } from "@/modules/progress/progress.service";
import { lessonService } from "@/modules/lessons/lesson.service";
import {
  DuplicateEnrollmentError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/shared/errors/domain-errors";
import { calculateStreak, getVietnamDateString } from "@/shared/utils/date";
import { LessonProgressStatus } from "@prisma/client";

describe("Phase 5: Enrollment, Lesson Consumption and Progress Tracking", () => {
  let testUserA: { id: string; email: string };
  let testUserB: { id: string; email: string };
  let publishedCourse: { id: string; slug: string };
  let courseLessons: { id: string; slug: string }[];
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    // 1. Get published course from seed
    const course = await prisma.course.findFirstOrThrow({
      where: { slug: "tieng-han-tu-con-so-0" },
      include: {
        chapters: {
          include: {
            lessons: { where: { status: "PUBLISHED" }, orderBy: { displayOrder: "asc" } },
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    publishedCourse = { id: course.id, slug: course.slug };
    courseLessons = course.chapters.flatMap((c) =>
      c.lessons.map((l) => ({ id: l.id, slug: l.slug }))
    );

    // 2. Create clean test users
    const timestamp = Date.now();
    testUserA = await prisma.user.create({
      data: {
        id: `test-student-a-${timestamp}`,
        email: `student_a_${timestamp}@example.com`,
        name: "Học Viên A",
        role: "STUDENT",
      },
    });

    testUserB = await prisma.user.create({
      data: {
        id: `test-student-b-${timestamp}`,
        email: `student_b_${timestamp}@example.com`,
        name: "Học Viên B",
        role: "STUDENT",
      },
    });
    createdUserIds.push(testUserA.id, testUserB.id);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  async function persistPassingAttempt(userId: string, lessonId: string) {
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { lessonId, status: "PUBLISHED" } });
    await prisma.exerciseAttempt.create({
      data: { userId, exerciseId: exercise.id, score: 40, maxScore: 40, percentage: 100, isPassing: true, submittedAt: new Date() },
    });
  }

  // 1. DUPLICATE ENROLLMENT
  describe("Enrollment Rules", () => {
    it("allows an authenticated student to enroll in a published course", async () => {
      const enrollment = await courseService.enrollStudent(testUserA.id, publishedCourse.id);
      expect(enrollment).toBeDefined();
      expect(enrollment.userId).toBe(testUserA.id);
      expect(enrollment.courseId).toBe(publishedCourse.id);

      const isEnrolled = await courseService.isStudentEnrolled(testUserA.id, publishedCourse.id);
      expect(isEnrolled).toBe(true);
    });

    it("rejects duplicate enrollment with DuplicateEnrollmentError", async () => {
      // First enrollment succeeds
      await courseService.enrollStudent(testUserA.id, publishedCourse.id);

      // Second enrollment must fail
      await expect(
        courseService.enrollStudent(testUserA.id, publishedCourse.id)
      ).rejects.toThrow(DuplicateEnrollmentError);
    });

    it("rejects unauthenticated enrollment with UnauthorizedError", async () => {
      await expect(
        courseService.enrollStudent("", publishedCourse.id)
      ).rejects.toThrow(UnauthorizedError);
    });

    it("rejects enrollment for non-existent course with NotFoundError", async () => {
      await expect(
        courseService.enrollStudent(testUserA.id, "non-existent-course-id")
      ).rejects.toThrow(NotFoundError);
    });
  });

  // 2. UNAUTHORIZED PROGRESS UPDATES
  describe("Authorization & Security Guards", () => {
    it("rejects progress modification when user tries to update another student's progress", async () => {
      const lesson1 = courseLessons[0];

      await expect(
        progressService.startLesson({
          requestingUserId: testUserA.id,
          targetUserId: testUserB.id,
          lessonId: lesson1.id,
        })
      ).rejects.toThrow(ForbiddenError);

      await expect(
        progressService.completeLesson({
          requestingUserId: testUserA.id,
          targetUserId: testUserB.id,
          lessonId: lesson1.id,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejects progress modification if requestingUserId is missing", async () => {
      const lesson1 = courseLessons[0];

      await expect(
        progressService.completeLesson({
          requestingUserId: "",
          targetUserId: testUserA.id,
          lessonId: lesson1.id,
        })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  // 3. IDEMPOTENT START & IDEMPOTENT COMPLETION
  describe("Idempotent Progress Operations", () => {
    it("starts a lesson idempotently without overwriting timestamp or regressing status", async () => {
      const lesson1 = courseLessons[0];
      await courseService.enrollStudent(testUserA.id, publishedCourse.id);

      // First start
      const progress1 = await progressService.startLesson({
        requestingUserId: testUserA.id,
        targetUserId: testUserA.id,
        lessonId: lesson1.id,
      });

      expect(progress1.status).toBe(LessonProgressStatus.IN_PROGRESS);
      expect(progress1.startedAt).toBeDefined();

      // Second start (idempotent)
      const progress2 = await progressService.startLesson({
        requestingUserId: testUserA.id,
        targetUserId: testUserA.id,
        lessonId: lesson1.id,
      });

      expect(progress2.id).toBe(progress1.id);
      expect(progress2.status).toBe(LessonProgressStatus.IN_PROGRESS);
      expect(new Date(progress2.startedAt!).getTime()).toBe(
        new Date(progress1.startedAt!).getTime()
      );
    });

    it("completes a lesson idempotently without duplicating DailyStudyStat counts", async () => {
      const lesson1 = courseLessons[0];
      const todayStr = getVietnamDateString(new Date());
      await courseService.enrollStudent(testUserA.id, publishedCourse.id);
      await persistPassingAttempt(testUserA.id, lesson1.id);

      // First completion
      const completed1 = await progressService.completeLesson({
        requestingUserId: testUserA.id,
        targetUserId: testUserA.id,
        lessonId: lesson1.id,
      });

      expect(completed1.status).toBe(LessonProgressStatus.COMPLETED);
      expect(completed1.completedAt).toBeDefined();

      const statAfterFirst = await prisma.dailyStudyStat.findUnique({
        where: {
          userId_date: {
            userId: testUserA.id,
            date: todayStr,
          },
        },
      });
      expect(statAfterFirst?.lessonsCompleted).toBe(1);

      // Second completion (idempotent duplicate call)
      const completed2 = await progressService.completeLesson({
        requestingUserId: testUserA.id,
        targetUserId: testUserA.id,
        lessonId: lesson1.id,
      });

      expect(completed2.id).toBe(completed1.id);
      expect(completed2.status).toBe(LessonProgressStatus.COMPLETED);

      // Verify DailyStudyStat did NOT increment again
      const statAfterSecond = await prisma.dailyStudyStat.findUnique({
        where: {
          userId_date: {
            userId: testUserA.id,
            date: todayStr,
          },
        },
      });
      expect(statAfterSecond?.lessonsCompleted).toBe(1);
    });

    it("retains the highest persisted passing score on retake without another completion", async () => {
      const lessonId = courseLessons[0].id;
      await courseService.enrollStudent(testUserA.id, publishedCourse.id);
      const exercise = await prisma.exercise.findFirstOrThrow({ where: { lessonId, status: "PUBLISHED" } });
      await prisma.exerciseAttempt.create({ data: { userId: testUserA.id, exerciseId: exercise.id, score: 32, maxScore: 40, percentage: 80, isPassing: true, submittedAt: new Date() } });
      const request = () => progressService.completeLesson({ requestingUserId: testUserA.id, targetUserId: testUserA.id, lessonId });
      const first = await request();
      expect(first.score).toBe(80);
      await prisma.exerciseAttempt.create({ data: { userId: testUserA.id, exerciseId: exercise.id, score: 40, maxScore: 40, percentage: 100, isPassing: true, submittedAt: new Date() } });
      const improved = await request();
      expect(improved.score).toBe(100);
      expect(improved.completedAt?.getTime()).toBe(first.completedAt?.getTime());
      expect((await request()).score).toBe(100);
      const stat = await prisma.dailyStudyStat.findUniqueOrThrow({ where: { userId_date: { userId: testUserA.id, date: getVietnamDateString() } } });
      expect(stat.lessonsCompleted).toBe(1);
    });
  });

  // 4. ORDERED NEXT & PREVIOUS LESSON NAVIGATION
  describe("Curriculum Ordering & Navigation", () => {
    it("determines correct previous and next lessons across chapters", async () => {
      await courseService.enrollStudent(testUserA.id, publishedCourse.id);
      await prisma.lessonProgress.createMany({ data: courseLessons.slice(0, -1).map((lesson) => ({ userId: testUserA.id, lessonId: lesson.id, status: LessonProgressStatus.COMPLETED, completedAt: new Date() })) });
      const firstLessonSlug = courseLessons[0].slug;
      const firstNav = await lessonService.getPublishedLessonWithNavigation(firstLessonSlug, testUserA.id);

      expect(firstNav).toBeDefined();
      expect(firstNav?.previousLesson).toBeNull();
      expect(firstNav?.nextLesson).toBeDefined();
      expect(firstNav?.nextLesson?.slug).toBe(courseLessons[1].slug);
      expect(firstNav?.currentLessonIndex).toBe(1);

      // Middle lesson navigation
      const middleLessonSlug = courseLessons[1].slug;
      const middleNav = await lessonService.getPublishedLessonWithNavigation(middleLessonSlug, testUserA.id);
      expect(middleNav?.previousLesson?.slug).toBe(courseLessons[0].slug);
      expect(middleNav?.nextLesson?.slug).toBe(courseLessons[2].slug);

      // Last lesson navigation
      const lastLessonSlug = courseLessons[courseLessons.length - 1].slug;
      const lastNav = await lessonService.getPublishedLessonWithNavigation(lastLessonSlug, testUserA.id);
      expect(lastNav?.previousLesson).toBeDefined();
      expect(lastNav?.nextLesson).toBeNull();
      expect(lastNav?.currentLessonIndex).toBe(courseLessons.length);
    });
  });

  // 5. COMPLETION PERCENTAGE & NEXT LESSON CANDIDATE
  describe("Course Completion Metrics", () => {
    it("calculates accurate completion percentage and next lesson in progress", async () => {
      // Enroll User A
      await courseService.enrollStudent(testUserA.id, publishedCourse.id);

      // 0% initially
      const initialProgress = await progressService.getCourseProgress(
        testUserA.id,
        publishedCourse.id
      );
      expect(initialProgress.totalLessons).toBe(courseLessons.length);
      expect(initialProgress.completedLessons).toBe(0);
      expect(initialProgress.progressPercentage).toBe(0);
      expect(initialProgress.isCompleted).toBe(false);
      expect(initialProgress.nextLesson?.slug).toBe(courseLessons[0].slug);

      // Complete the first two published lessons.
      await persistPassingAttempt(testUserA.id, courseLessons[0].id);
      await progressService.completeLesson({
        requestingUserId: testUserA.id,
        targetUserId: testUserA.id,
        lessonId: courseLessons[0].id,
      });
      await persistPassingAttempt(testUserA.id, courseLessons[1].id);
      await progressService.completeLesson({
        requestingUserId: testUserA.id,
        targetUserId: testUserA.id,
        lessonId: courseLessons[1].id,
      });

      const updatedProgress = await progressService.getCourseProgress(
        testUserA.id,
        publishedCourse.id
      );
      expect(updatedProgress.completedLessons).toBe(2);
      expect(updatedProgress.progressPercentage).toBe(
        Math.round((2 / courseLessons.length) * 100)
      );
      expect(updatedProgress.nextLesson?.slug).toBe(courseLessons[2].slug);
    });

    it("marks enrollment completed when 100% of course lessons are completed", async () => {
      await courseService.enrollStudent(testUserB.id, publishedCourse.id);

      // Complete all lessons for User B
      for (const lesson of courseLessons) {
        await persistPassingAttempt(testUserB.id, lesson.id);
        await progressService.completeLesson({
          requestingUserId: testUserB.id,
          targetUserId: testUserB.id,
          lessonId: lesson.id,
        });
      }

      const finalProgress = await progressService.getCourseProgress(
        testUserB.id,
        publishedCourse.id
      );
      expect(finalProgress.completedLessons).toBe(courseLessons.length);
      expect(finalProgress.progressPercentage).toBe(100);
      expect(finalProgress.isCompleted).toBe(true);
      expect(finalProgress.nextLesson).toBeNull();

      // Check enrollment record has completedAt set
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: testUserB.id,
            courseId: publishedCourse.id,
          },
        },
      });
      expect(enrollment?.completedAt).not.toBeNull();
    });
  });

  // 6. STREAK ACROSS CONSECUTIVE AND MISSED DAYS
  describe("Deterministic Daily Study Streak", () => {
    const referenceDate = new Date("2026-09-30T10:00:00Z"); // Vietnam: 2026-09-30 (17:00)

    it("returns streak = 1 when student studied today", () => {
      const activeDates = ["2026-09-30"];
      const streak = calculateStreak(activeDates, referenceDate);
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
      expect(streak.studiedToday).toBe(true);
    });

    it("maintains streak when student studied yesterday but not yet today", () => {
      const activeDates = ["2026-09-29"];
      const streak = calculateStreak(activeDates, referenceDate);
      expect(streak.currentStreak).toBe(1);
      expect(streak.studiedToday).toBe(false);
    });

    it("increments streak across consecutive active days", () => {
      const activeDates = ["2026-09-28", "2026-09-29", "2026-09-30"];
      const streak = calculateStreak(activeDates, referenceDate);
      expect(streak.currentStreak).toBe(3);
      expect(streak.longestStreak).toBe(3);
      expect(streak.studiedToday).toBe(true);
    });

    it("resets current streak to 0 when student missed days but preserves longest historical streak", () => {
      // Active on 2026-09-20, 2026-09-21, 2026-09-22, 2026-09-23 (4 days run)
      // Missed 2026-09-28 and 2026-09-29
      const activeDates = ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23"];
      const streak = calculateStreak(activeDates, referenceDate);

      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(4);
      expect(streak.studiedToday).toBe(false);
      expect(streak.lastActiveDate).toBe("2026-09-23");
    });

    it("resumes current streak to 1 after a gap", () => {
      const activeDates = [
        "2026-09-20",
        "2026-09-21", // 2 days run
        "2026-09-30", // Active today after long break
      ];
      const streak = calculateStreak(activeDates, referenceDate);
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(2);
      expect(streak.studiedToday).toBe(true);
    });

    it("handles month rollover accurately (e.g. March 1 and February 28)", () => {
      const marchFirst = new Date("2026-03-01T04:00:00Z"); // 2026-03-01 in VN
      const activeDates = ["2026-02-28", "2026-03-01"];
      const streak = calculateStreak(activeDates, marchFirst);
      expect(streak.currentStreak).toBe(2);
      expect(streak.longestStreak).toBe(2);
    });
  });
});
