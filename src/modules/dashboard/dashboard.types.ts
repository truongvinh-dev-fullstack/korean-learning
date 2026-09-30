export interface DashboardMetrics {
  currentStreakDays: number;
  longestStreakDays: number;
  completedLessonsCount: number;
  totalWordsLearned: number;
  srsDueCount: number;
  studiedToday: boolean;
}

export interface DashboardCourseItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  chapterCount: number;
  lessonCount: number;
  completedLessonsCount: number;
  progressPercentage: number;
  isEnrolled: boolean;
  nextLesson?: {
    slug: string;
    title: string;
    chapterTitle?: string;
  } | null;
}

export interface ContinueLearningCardData {
  courseSlug: string;
  courseTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  chapterTitle: string;
  progressPercentage: number;
}

export interface StudentDashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  metrics: DashboardMetrics;
  courses: DashboardCourseItem[];
  continueLearning: ContinueLearningCardData | null;
  hasActivity: boolean;
}
