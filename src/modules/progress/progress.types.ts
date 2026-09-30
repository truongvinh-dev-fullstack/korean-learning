import { LessonProgressStatus } from "@prisma/client";

export interface LessonProgressData {
  id: string;
  userId: string;
  lessonId: string;
  status: LessonProgressStatus;
  score: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  studiedToday: boolean;
}

export interface CourseProgressData {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  isCompleted: boolean;
  nextLesson: {
    id: string;
    slug: string;
    title: string;
    chapterTitle: string;
  } | null;
}
