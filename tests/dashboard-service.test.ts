import { describe, it, expect, vi } from "vitest";
import { DashboardService } from "@/modules/dashboard/dashboard.service";
import { CourseService } from "@/modules/courses/course.service";
import { ProgressService } from "@/modules/progress/progress.service";

describe("DashboardService", () => {
  it("returns zero-state metrics and course catalog for a new student", async () => {
    const mockCourseService = {
      getPublishedCatalog: vi.fn().mockResolvedValue([
        {
          id: "course-1",
          slug: "tieng-han-tu-con-so-0",
          title: "Tiếng Hàn từ con số 0",
          description: "Khóa học nhập môn",
          level: "BEGINNER",
          chapterCount: 3,
          lessonCount: 8,
        },
      ]),
      isStudentEnrolled: vi.fn().mockResolvedValue(false),
    } as unknown as CourseService;

    const mockProgressService = {
      getUserStreak: vi.fn().mockResolvedValue({
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        studiedToday: false,
      }),
      getCourseProgress: vi.fn().mockResolvedValue({
        courseId: "course-1",
        totalLessons: 8,
        completedLessons: 0,
        progressPercentage: 0,
        isCompleted: false,
        nextLesson: {
          id: "lesson-1",
          slug: "bai-1-nguyen-am-co-ban",
          title: "Bài 1: Nguyên âm cơ bản",
          chapterTitle: "Chương 1",
        },
      }),
    } as unknown as ProgressService;

    const service = new DashboardService(mockCourseService, mockProgressService);

    const user = {
      id: "user-123",
      name: "Nguyễn Văn A",
      email: "vana@example.com",
      role: "STUDENT",
    };

    const dashboardData = await service.getStudentDashboardData(user);

    expect(dashboardData.user.id).toBe("user-123");
    expect(dashboardData.user.name).toBe("Nguyễn Văn A");
    expect(dashboardData.user.role).toBe("STUDENT");

    // Zero-state metrics
    expect(dashboardData.metrics.currentStreakDays).toBe(0);
    expect(dashboardData.metrics.completedLessonsCount).toBe(0);
    expect(dashboardData.metrics.totalWordsLearned).toBe(0);
    expect(dashboardData.metrics.srsDueCount).toBe(0);
    expect(dashboardData.metrics.studiedToday).toBe(false);
    expect(dashboardData.hasActivity).toBe(false);

    // Course list mapping
    expect(dashboardData.courses).toHaveLength(1);
    expect(dashboardData.courses[0].slug).toBe("tieng-han-tu-con-so-0");
    expect(dashboardData.courses[0].progressPercentage).toBe(0);
    expect(dashboardData.courses[0].completedLessonsCount).toBe(0);
    expect(dashboardData.courses[0].isEnrolled).toBe(false);
  });

  it("calculates continueLearning card when user is enrolled and has an upcoming lesson", async () => {
    const mockCourseService = {
      getPublishedCatalog: vi.fn().mockResolvedValue([
        {
          id: "course-1",
          slug: "tieng-han-tu-con-so-0",
          title: "Tiếng Hàn từ con số 0",
          description: "Khóa học nhập môn",
          level: "BEGINNER",
          chapterCount: 3,
          lessonCount: 8,
        },
      ]),
      isStudentEnrolled: vi.fn().mockResolvedValue(true),
    } as unknown as CourseService;

    const mockProgressService = {
      getUserStreak: vi.fn().mockResolvedValue({
        currentStreak: 2,
        longestStreak: 5,
        lastActiveDate: "2026-09-30",
        studiedToday: true,
      }),
      getCourseProgress: vi.fn().mockResolvedValue({
        courseId: "course-1",
        totalLessons: 8,
        completedLessons: 2,
        progressPercentage: 25,
        isCompleted: false,
        nextLesson: {
          id: "lesson-3",
          slug: "bai-3-phu-am-co-ban",
          title: "Bài 3: Phụ âm cơ bản",
          chapterTitle: "Chương 1",
        },
      }),
    } as unknown as ProgressService;

    const service = new DashboardService(mockCourseService, mockProgressService);

    const user = {
      id: "user-456",
      name: "Trần Thị B",
      email: "thib@example.com",
      role: "STUDENT",
    };

    const dashboardData = await service.getStudentDashboardData(user);
    expect(dashboardData.hasActivity).toBe(true);
    expect(dashboardData.metrics.currentStreakDays).toBe(2);
    expect(dashboardData.metrics.completedLessonsCount).toBe(2);
    expect(dashboardData.continueLearning).toBeDefined();
    expect(dashboardData.continueLearning?.lessonSlug).toBe("bai-3-phu-am-co-ban");
    expect(dashboardData.continueLearning?.progressPercentage).toBe(25);
  });
});
