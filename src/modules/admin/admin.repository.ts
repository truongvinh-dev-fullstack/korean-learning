import { prisma } from "@/shared/db/prisma";
import { Prisma } from "@prisma/client";
import {
  CourseFormData,
  ChapterFormData,
  LessonFormData,
  LessonBlockFormData,
  VocabularyFormData,
  ExerciseFormData,
  QuestionFormData,
} from "./admin.schema";

export class AdminRepository {
  // ==========================================
  // COURSES
  // ==========================================
  async findAllCourses() {
    return prisma.course.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        _count: {
          select: {
            chapters: true,
            enrollments: true,
          },
        },
      },
    });
  }

  async findCourseById(id: string) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { displayOrder: "asc" },
          include: {
            _count: { select: { lessons: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async findCourseBySlug(slug: string) {
    return prisma.course.findUnique({
      where: { slug },
    });
  }

  async getNextCourseDisplayOrder(): Promise<number> {
    const aggregate = await prisma.course.aggregate({
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }

  async createCourse(data: CourseFormData) {
    return prisma.course.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        level: data.level ?? "BEGINNER",
        status: data.status ?? "DRAFT",
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateCourse(id: string, data: Partial<CourseFormData>) {
    return prisma.course.update({
      where: { id },
      data,
    });
  }

  async deleteCourse(id: string) {
    return prisma.course.delete({
      where: { id },
    });
  }

  async countCourseEnrollments(courseId: string): Promise<number> {
    return prisma.enrollment.count({
      where: { courseId },
    });
  }

  // ==========================================
  // CHAPTERS
  // ==========================================
  async findChaptersByCourseId(courseId: string) {
    return prisma.chapter.findMany({
      where: { courseId },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { lessons: true } },
      },
    });
  }

  async findChapterById(id: string) {
    return prisma.chapter.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        lessons: {
          orderBy: { displayOrder: "asc" },
          include: {
            _count: {
              select: {
                blocks: true,
                vocabularies: true,
                exercises: true,
                progresses: true,
              },
            },
          },
        },
      },
    });
  }

  async findChapterByCourseAndSlug(courseId: string, slug: string) {
    return prisma.chapter.findUnique({
      where: {
        courseId_slug: { courseId, slug },
      },
    });
  }

  async getNextChapterDisplayOrder(courseId: string): Promise<number> {
    const aggregate = await prisma.chapter.aggregate({
      where: { courseId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }

  async createChapter(data: ChapterFormData) {
    return prisma.chapter.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        slug: data.slug,
        description: data.description ?? null,
        status: data.status ?? "DRAFT",
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateChapter(id: string, data: Partial<ChapterFormData>) {
    return prisma.chapter.update({
      where: { id },
      data,
    });
  }

  async deleteChapter(id: string) {
    return prisma.chapter.delete({
      where: { id },
    });
  }

  async countChapterStudentProgress(chapterId: string): Promise<number> {
    return prisma.lessonProgress.count({
      where: {
        lesson: { chapterId },
      },
    });
  }

  // ==========================================
  // LESSONS
  // ==========================================
  async findLessonsByChapterId(chapterId: string) {
    return prisma.lesson.findMany({
      where: { chapterId },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: {
          select: {
            blocks: true,
            vocabularies: true,
            exercises: true,
            progresses: true,
          },
        },
      },
    });
  }

  async findLessonById(id: string) {
    return prisma.lesson.findUnique({
      where: { id },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
        blocks: {
          orderBy: { displayOrder: "asc" },
        },
        vocabularies: {
          orderBy: { displayOrder: "asc" },
        },
        exercises: {
          orderBy: { displayOrder: "asc" },
          include: {
            questions: {
              orderBy: { displayOrder: "asc" },
              include: {
                options: { orderBy: { displayOrder: "asc" } },
              },
            },
          },
        },
        _count: {
          select: {
            progresses: true,
          },
        },
      },
    });
  }

  async findLessonBySlug(slug: string) {
    return prisma.lesson.findUnique({
      where: { slug },
    });
  }

  async getNextLessonDisplayOrder(chapterId: string): Promise<number> {
    const aggregate = await prisma.lesson.aggregate({
      where: { chapterId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }

  async createLesson(data: LessonFormData) {
    return prisma.lesson.create({
      data: {
        chapterId: data.chapterId,
        title: data.title,
        slug: data.slug,
        summary: data.summary ?? null,
        estimatedMinutes: data.estimatedMinutes ?? 15,
        status: data.status ?? "DRAFT",
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateLesson(id: string, data: Partial<LessonFormData>) {
    return prisma.lesson.update({
      where: { id },
      data,
    });
  }

  async deleteLesson(id: string) {
    return prisma.lesson.delete({
      where: { id },
    });
  }

  async getLessonStudentActivityCounts(lessonId: string) {
    const [progressCount, attemptsCount, srsCardCount] = await Promise.all([
      prisma.lessonProgress.count({ where: { lessonId } }),
      prisma.exerciseAttempt.count({ where: { exercise: { lessonId } } }),
      prisma.reviewCard.count({ where: { vocabulary: { lessonId } } }),
    ]);
    return { progressCount, attemptsCount, srsCardCount };
  }

  // ==========================================
  // BLOCKS
  // ==========================================
  async findBlocksByLessonId(lessonId: string) {
    return prisma.lessonBlock.findMany({
      where: { lessonId },
      orderBy: { displayOrder: "asc" },
    });
  }

  async findBlockById(id: string) {
    return prisma.lessonBlock.findUnique({
      where: { id },
    });
  }

  async getNextBlockDisplayOrder(lessonId: string): Promise<number> {
    const aggregate = await prisma.lessonBlock.aggregate({
      where: { lessonId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }

  async createBlock(data: LessonBlockFormData) {
    return prisma.lessonBlock.create({
      data: {
        lessonId: data.lessonId,
        type: data.type,
        content: data.content as Prisma.InputJsonValue,
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateBlock(
    id: string,
    data: { type?: LessonBlockFormData["type"]; content?: unknown; displayOrder?: number }
  ) {
    return prisma.lessonBlock.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.content !== undefined && {
          content: data.content as Prisma.InputJsonValue,
        }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      },
    });
  }

  async deleteBlock(id: string) {
    return prisma.lessonBlock.delete({
      where: { id },
    });
  }

  // ==========================================
  // VOCABULARY
  // ==========================================
  async findVocabulariesByLessonId(lessonId: string) {
    return prisma.vocabulary.findMany({
      where: { lessonId },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { reviewCards: true } },
      },
    });
  }

  async findVocabularyById(id: string) {
    return prisma.vocabulary.findUnique({
      where: { id },
      include: {
        _count: { select: { reviewCards: true } },
      },
    });
  }

  async getNextVocabularyDisplayOrder(lessonId: string): Promise<number> {
    const aggregate = await prisma.vocabulary.aggregate({
      where: { lessonId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }

  async createVocabulary(data: VocabularyFormData) {
    return prisma.vocabulary.create({
      data: {
        lessonId: data.lessonId,
        hangul: data.hangul,
        romanization: data.romanization,
        vietnameseMeaning: data.vietnameseMeaning,
        englishMeaning: data.englishMeaning ?? "",
        partOfSpeech: data.partOfSpeech ?? null,
        audioUrl: data.audioUrl ?? null,
        exampleSentenceHangul: data.exampleSentenceHangul ?? null,
        exampleSentenceVi: data.exampleSentenceVi ?? null,
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateVocabulary(id: string, data: Partial<VocabularyFormData>) {
    return prisma.vocabulary.update({
      where: { id },
      data: {
        ...(data.hangul !== undefined && { hangul: data.hangul }),
        ...(data.romanization !== undefined && { romanization: data.romanization }),
        ...(data.vietnameseMeaning !== undefined && { vietnameseMeaning: data.vietnameseMeaning }),
        ...(data.englishMeaning !== undefined && { englishMeaning: data.englishMeaning ?? "" }),
        ...(data.partOfSpeech !== undefined && { partOfSpeech: data.partOfSpeech }),
        ...(data.audioUrl !== undefined && { audioUrl: data.audioUrl }),
        ...(data.exampleSentenceHangul !== undefined && {
          exampleSentenceHangul: data.exampleSentenceHangul,
        }),
        ...(data.exampleSentenceVi !== undefined && {
          exampleSentenceVi: data.exampleSentenceVi,
        }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      },
    });
  }

  async deleteVocabulary(id: string) {
    return prisma.vocabulary.delete({
      where: { id },
    });
  }

  async countReviewCardsForVocabulary(vocabularyId: string): Promise<number> {
    return prisma.reviewCard.count({
      where: { vocabularyId },
    });
  }

  // ==========================================
  // EXERCISES & QUESTIONS
  // ==========================================
  async findExercisesByLessonId(lessonId: string) {
    return prisma.exercise.findMany({
      where: { lessonId },
      orderBy: { displayOrder: "asc" },
      include: {
        questions: {
          orderBy: { displayOrder: "asc" },
          include: {
            options: { orderBy: { displayOrder: "asc" } },
            _count: { select: { attemptAnswers: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });
  }

  async findExerciseById(id: string) {
    return prisma.exercise.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { displayOrder: "asc" },
          include: {
            options: { orderBy: { displayOrder: "asc" } },
            _count: { select: { attemptAnswers: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });
  }

  async getNextExerciseDisplayOrder(lessonId: string): Promise<number> {
    const aggregate = await prisma.exercise.aggregate({
      where: { lessonId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }

  async createExercise(data: ExerciseFormData) {
    return prisma.exercise.create({
      data: {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? "DRAFT",
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateExercise(id: string, data: Partial<ExerciseFormData>) {
    return prisma.exercise.update({
      where: { id },
      data,
    });
  }

  async deleteExercise(id: string) {
    return prisma.exercise.delete({
      where: { id },
    });
  }

  async countAttemptsForExercise(exerciseId: string): Promise<number> {
    return prisma.exerciseAttempt.count({
      where: { exerciseId },
    });
  }

  async findQuestionsByExerciseId(exerciseId: string) {
    return prisma.question.findMany({
      where: { exerciseId },
      orderBy: { displayOrder: "asc" },
      include: {
        options: { orderBy: { displayOrder: "asc" } },
        _count: { select: { attemptAnswers: true } },
      },
    });
  }

  async findQuestionById(id: string) {
    return prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { displayOrder: "asc" } },
        _count: { select: { attemptAnswers: true } },
      },
    });
  }

  async getNextQuestionDisplayOrder(exerciseId: string): Promise<number> {
    const aggregate = await prisma.question.aggregate({
      where: { exerciseId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }

  async createQuestion(data: QuestionFormData) {
    return prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          exerciseId: data.exerciseId,
          type: data.type,
          prompt: data.prompt,
          audioUrl: data.audioUrl ?? null,
          correctAnswer: data.correctAnswer ?? null,
          explanation: data.explanation ?? null,
          displayOrder: data.displayOrder ?? 0,
        },
      });

      if (data.options && data.options.length > 0) {
        await tx.questionOption.createMany({
          data: data.options.map((opt, idx) => ({
            questionId: question.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
            explanation: opt.explanation ?? null,
            displayOrder: opt.displayOrder ?? idx,
          })),
        });
      }

      return tx.question.findUnique({
        where: { id: question.id },
        include: {
          options: { orderBy: { displayOrder: "asc" } },
        },
      });
    });
  }

  async updateQuestion(id: string, data: Partial<QuestionFormData>) {
    return prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id },
        data: {
          ...(data.type && { type: data.type }),
          ...(data.prompt !== undefined && { prompt: data.prompt }),
          ...(data.audioUrl !== undefined && { audioUrl: data.audioUrl }),
          ...(data.correctAnswer !== undefined && { correctAnswer: data.correctAnswer }),
          ...(data.explanation !== undefined && { explanation: data.explanation }),
          ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        },
      });

      if (data.options !== undefined) {
        await tx.questionOption.deleteMany({
          where: { questionId: id },
        });

        if (data.options.length > 0) {
          await tx.questionOption.createMany({
            data: data.options.map((opt, idx) => ({
              questionId: id,
              text: opt.text,
              isCorrect: opt.isCorrect,
              explanation: opt.explanation ?? null,
              displayOrder: opt.displayOrder ?? idx,
            })),
          });
        }
      }

      return tx.question.findUnique({
        where: { id },
        include: {
          options: { orderBy: { displayOrder: "asc" } },
        },
      });
    });
  }

  async deleteQuestion(id: string) {
    return prisma.question.delete({
      where: { id },
    });
  }

  async countAnswersForQuestion(questionId: string): Promise<number> {
    return prisma.attemptAnswer.count({
      where: { questionId },
    });
  }

  // ==========================================
  // ATOMIC SWAP REORDERING HELPERS
  // ==========================================
  async swapOrder(
    model: "course" | "chapter" | "lesson" | "lessonBlock" | "vocabulary" | "exercise" | "question",
    itemA: { id: string; displayOrder: number },
    itemB: { id: string; displayOrder: number }
  ) {
    return prisma.$transaction(async (tx) => {
      // Use temporary negative order to bypass unique constraint collisions if any
      const tempOrder = -99999;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (tx as any)[model];
      await delegate.update({
        where: { id: itemA.id },
        data: { displayOrder: tempOrder },
      });
      await delegate.update({
        where: { id: itemB.id },
        data: { displayOrder: itemA.displayOrder },
      });
      await delegate.update({
        where: { id: itemA.id },
        data: { displayOrder: itemB.displayOrder },
      });
    });
  }
}

export const adminRepository = new AdminRepository();
