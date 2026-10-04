import { lessonRepository, LessonRepository } from "./lesson.repository";
import { validateLessonBlockRecord, ValidatedLessonBlock } from "./lesson-block.schema";
import { lessonAccessService } from "./lesson-access.service";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors/domain-errors";

export class LessonService {
  constructor(private readonly repo: LessonRepository = lessonRepository) {}

  /**
   * Retrieves a published lesson by slug with validated, discriminated blocks.
   * Throws an error or returns null if not found. Never returns unvalidated JSON blocks.
   */
  async getPublishedLessonBySlug(slug: string, userId: string | null | undefined) {
    const decision = await lessonAccessService.resolveBySlug(userId, slug);
    if (decision.kind === "NOT_FOUND") return null;
    if (decision.kind === "UNAUTHENTICATED") throw new UnauthorizedError();
    if (decision.kind !== "AVAILABLE") throw new ForbiddenError();
    const rawLesson = await this.repo.findPublishedLessonBySlug(slug);
    if (!rawLesson) {
      return null;
    }

    // Strictly validate every block against its respective Zod schema
    const validatedBlocks: ValidatedLessonBlock[] = rawLesson.blocks.map((block) =>
      validateLessonBlockRecord({
        id: block.id,
        lessonId: block.lessonId,
        type: block.type,
        displayOrder: block.displayOrder,
        content: block.content,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      })
    );

    return {
      id: rawLesson.id,
      slug: rawLesson.slug,
      title: rawLesson.title,
      summary: rawLesson.summary,
      estimatedMinutes: rawLesson.estimatedMinutes,
      level: rawLesson.level,
      tags: rawLesson.tags,
      learningObjectives: rawLesson.learningObjectives,
      displayOrder: rawLesson.displayOrder,
      status: rawLesson.status,
      createdAt: rawLesson.createdAt,
      updatedAt: rawLesson.updatedAt,
      chapter: rawLesson.chapter,
      blocks: validatedBlocks,
      vocabularies: rawLesson.vocabularies.map((v) => ({
        id: v.id,
        hangul: v.hangul,
        romanization: v.romanization,
        vietnameseMeaning: v.vietnameseMeaning,
        englishMeaning: v.englishMeaning,
        partOfSpeech: v.partOfSpeech,
        audioUrl: v.audioUrl,
        exampleSentenceHangul: v.exampleSentenceHangul,
        exampleSentenceVi: v.exampleSentenceVi,
        displayOrder: v.displayOrder,
      })),
      exercises: rawLesson.exercises,
    };
  }

  /**
   * Retrieves a published lesson with previous and next navigation within the course curriculum.
   */
  async getPublishedLessonWithNavigation(slug: string, userId: string) {
    const lesson = await this.getPublishedLessonBySlug(slug, userId);
    if (!lesson) {
      return null;
    }

    const orderedLessons = await this.repo.findOrderedLessonsForCourse(
      lesson.chapter.course.id
    );

    const currentIndex = orderedLessons.findIndex((l) => l.id === lesson.id);

    const previousLesson =
      currentIndex > 0
        ? {
            id: orderedLessons[currentIndex - 1].id,
            slug: orderedLessons[currentIndex - 1].slug,
            title: orderedLessons[currentIndex - 1].title,
            chapterTitle: orderedLessons[currentIndex - 1].chapter.title,
          }
        : null;

    const nextLesson =
      currentIndex >= 0 && currentIndex < orderedLessons.length - 1
        ? {
            id: orderedLessons[currentIndex + 1].id,
            slug: orderedLessons[currentIndex + 1].slug,
            title: orderedLessons[currentIndex + 1].title,
            chapterTitle: orderedLessons[currentIndex + 1].chapter.title,
          }
        : null;

    return {
      lesson,
      previousLesson,
      nextLesson,
      totalCourseLessons: orderedLessons.length,
      currentLessonIndex: currentIndex + 1,
    };
  }

  /**
   * Retrieves all published lessons for a course in sequence.
   */
  async getOrderedLessonsForCourse(courseId: string) {
    return this.repo.findOrderedLessonsForCourse(courseId);
  }
}

export const lessonService = new LessonService();
