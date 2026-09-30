import { courseService, CourseService } from "@/modules/courses/course.service";
import { progressService, ProgressService } from "@/modules/progress/progress.service";
import { srsService, SrsService } from "@/modules/srs/srs.service";
import {
  StudentDashboardData,
  DashboardCourseItem,
  ContinueLearningCardData,
} from "./dashboard.types";

export interface StudentDashboardUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
}

export class DashboardService {
  constructor(
    private readonly courses: CourseService = courseService,
    private readonly progress: ProgressService = progressService,
    private readonly srs: SrsService = srsService
  ) {}

  /**
   * Builds the typed dashboard data for an authenticated student.
   * Calculates actual streak, course progress percentages, and continue-learning card.
   */
  async getStudentDashboardData(user: StudentDashboardUser): Promise<StudentDashboardData> {
    const publishedCourses = await this.courses.getPublishedCatalog();
    const streakData = await this.progress.getUserStreak(user.id);

    let totalCompletedLessons = 0;
    const courseItems: DashboardCourseItem[] = [];
    let continueLearning: ContinueLearningCardData | null = null;

    for (const course of publishedCourses) {
      const isEnrolled = await this.courses.isStudentEnrolled(user.id, course.id);
      const progressData = await this.progress.getCourseProgress(user.id, course.id);

      totalCompletedLessons += progressData.completedLessons;

      courseItems.push({
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        level: course.level,
        chapterCount: course.chapterCount,
        lessonCount: course.lessonCount,
        completedLessonsCount: progressData.completedLessons,
        progressPercentage: progressData.progressPercentage,
        isEnrolled,
        nextLesson: progressData.nextLesson,
      });

      // Find first enrolled course that is in progress with an upcoming lesson
      if (!continueLearning && isEnrolled && progressData.nextLesson) {
        continueLearning = {
          courseSlug: course.slug,
          courseTitle: course.title,
          lessonSlug: progressData.nextLesson.slug,
          lessonTitle: progressData.nextLesson.title,
          chapterTitle: progressData.nextLesson.chapterTitle,
          progressPercentage: progressData.progressPercentage,
        };
      }
    }

    const srsSummary = await this.srs.getReviewSummaryForStudent(user.id);

    const metrics = {
      currentStreakDays: streakData.currentStreak,
      longestStreakDays: streakData.longestStreak,
      completedLessonsCount: totalCompletedLessons,
      totalWordsLearned:
        srsSummary.totalCards > 0 ? srsSummary.totalCards : totalCompletedLessons * 5,
      srsDueCount: srsSummary.dueTodayCount,
      studiedToday: streakData.studiedToday,
    };

    const hasActivity =
      metrics.completedLessonsCount > 0 ||
      metrics.currentStreakDays > 0 ||
      courseItems.some((c) => c.isEnrolled);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "STUDENT",
      },
      metrics,
      courses: courseItems,
      continueLearning,
      hasActivity,
    };
  }
}

export const dashboardService = new DashboardService();
