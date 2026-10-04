import { prisma } from "@/shared/db/prisma";
import { Prisma } from "@prisma/client";
import { ConflictError, ValidationError } from "@/shared/errors/domain-errors";
import { VocabularyBlockContentSchema } from "@/modules/lessons/lesson-block.schema";
import { swapDisplayOrder, insertDisplayOrder, moveDisplayOrder } from "./admin-order";
import { withSerializableRetry } from "./admin-transaction";
import { validateLessonForPublish } from "./lesson-publish";
import { QuestionFormSchema } from "./admin.schema";
import { isManualQuestion } from "@/modules/exercises/question.schema";
import {
  CourseFormData,
  ChapterFormData,
  LessonFormData,
  LessonBlockFormData,
  VocabularyFormData,
  ExerciseFormData,
  QuestionFormData,
  QuestionPatchData,
} from "./admin.schema";

export class AdminRepository {
  // ==========================================
  // COURSES
  // ==========================================
  async findAllCourses() {
    return prisma.course.findMany({
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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
    return withSerializableRetry(async (tx) => {
      const whereLesson = { chapter: { courseId: id } };
      const counts = [
        await tx.enrollment.count({ where: { courseId: id } }),
        await tx.lessonProgress.count({ where: { lesson: whereLesson } }),
        await tx.exerciseAttempt.count({ where: { exercise: { lesson: whereLesson } } }),
        await tx.reviewCard.count({ where: { vocabulary: { lesson: whereLesson } } }),
        await tx.reviewLog.count({ where: { card: { vocabulary: { lesson: whereLesson } } } }),
      ];
      if (counts.some((count) => count > 0)) {
        throw new ConflictError("Không thể xóa khóa học vì đã có dữ liệu học tập của học viên.");
      }
      return tx.course.delete({ where: { id } });
    });
  }

  // ==========================================
  // CHAPTERS
  // ==========================================
  async findChaptersByCourseId(courseId: string) {
    return prisma.chapter.findMany({
      where: { courseId },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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
    return withSerializableRetry(async (tx) => {
      const chapter = await tx.chapter.findUniqueOrThrow({ where: { id }, select: { courseId: true } });
      const whereLesson = { chapterId: id };
      const counts = [
        await tx.enrollment.count({ where: { courseId: chapter.courseId } }),
        await tx.lessonProgress.count({ where: { lesson: whereLesson } }),
        await tx.exerciseAttempt.count({ where: { exercise: { lesson: whereLesson } } }),
        await tx.reviewCard.count({ where: { vocabulary: { lesson: whereLesson } } }),
        await tx.reviewLog.count({ where: { card: { vocabulary: { lesson: whereLesson } } } }),
      ];
      if (counts.some((count) => count > 0)) {
        throw new ConflictError("Không thể xóa chương vì đã có dữ liệu học tập của học viên.");
      }
      return tx.chapter.delete({ where: { id } });
    });
  }

  // ==========================================
  // LESSONS
  // ==========================================
  async findLessonsByChapterId(chapterId: string) {
    return prisma.lesson.findMany({
      where: { chapterId },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        },
        vocabularies: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        },
        exercises: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          include: {
            questions: {
              orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
              include: {
                options: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
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
        level: data.level ?? null,
        tags: data.tags ?? [],
        learningObjectives: data.learningObjectives ?? [],
        status: data.status ?? "DRAFT",
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateLesson(id: string, data: Partial<LessonFormData>) {
    return withSerializableRetry(async (tx) => {
      const existing = await tx.lesson.findUniqueOrThrow({ where: { id }, include: {
        blocks: true, vocabularies: true, exercises: { include: { questions: { include: { options: true } } } },
      } });
      if ((data.status ?? existing.status) === "PUBLISHED") validateLessonForPublish({ ...existing, ...data });
      return tx.lesson.update({ where: { id }, data });
    });
  }

  async deleteLesson(id: string) {
    return withSerializableRetry(async (tx) => {
      const counts = [
        await tx.lessonProgress.count({ where: { lessonId: id } }),
        await tx.exerciseAttempt.count({ where: { exercise: { lessonId: id } } }),
        await tx.reviewCard.count({ where: { vocabulary: { lessonId: id } } }),
      ];
      if (counts.some((count) => count > 0)) throw new ConflictError("Không thể xóa bài học đã có dữ liệu học tập của học viên.");
      return tx.lesson.delete({ where: { id } });
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
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  async findBlockById(id: string) {
    return prisma.lessonBlock.findUnique({
      where: { id },
    });
  }

  async createBlock(data: LessonBlockFormData) {
    return withSerializableRetry(async (tx) => {
      await this.validateVocabularyReferences(tx, data.lessonId, data.type, data.content);
      const displayOrder = await insertDisplayOrder(tx, "lessonBlock", data.lessonId, data.displayOrder);
      return tx.lessonBlock.create({
      data: {
        lessonId: data.lessonId,
        type: data.type,
        content: data.content as Prisma.InputJsonValue,
        displayOrder,
      },
      });
    });
  }

  async updateBlock(
    id: string,
    data: { type?: LessonBlockFormData["type"]; content?: unknown; displayOrder?: number }
  ) {
    return withSerializableRetry(async (tx) => {
      const existing = await tx.lessonBlock.findUniqueOrThrow({ where: { id } });
      await this.validateVocabularyReferences(tx, existing.lessonId, data.type ?? existing.type, data.content ?? existing.content);
      await moveDisplayOrder(tx, "lessonBlock", existing.lessonId, id, data.displayOrder);
      return tx.lessonBlock.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.content !== undefined && {
          content: data.content as Prisma.InputJsonValue,
        }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      },
      });
    });
  }

  private async validateVocabularyReferences(tx: Prisma.TransactionClient, lessonId: string, type: string, content: unknown) {
    if (type !== "VOCABULARY") return;
    const parsed = VocabularyBlockContentSchema.parse(content);
    if (!parsed.vocabularyIds) return;
    const count = await tx.vocabulary.count({ where: { lessonId, id: { in: parsed.vocabularyIds } } });
    if (count !== parsed.vocabularyIds.length) throw new ValidationError("Từ được chọn phải tồn tại trong ngân hàng của bài học.", { content: { vocabularyIds: { _errors: ["Có từ không thuộc bài học hoặc đã bị xóa"] } } });
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
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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

  async createVocabulary(data: VocabularyFormData) {
    return withSerializableRetry(async (tx) => {
      const displayOrder = await insertDisplayOrder(tx, "vocabulary", data.lessonId, data.displayOrder);
      return tx.vocabulary.create({
      data: {
        lessonId: data.lessonId,
        hangul: data.hangul,
        romanization: data.romanization,
        vietnameseMeaning: data.vietnameseMeaning,
        englishMeaning: data.englishMeaning ?? "",
        partOfSpeech: data.partOfSpeech ?? null,
        difficulty: data.difficulty ?? null,
        tags: data.tags ?? [],
        audioUrl: data.audioUrl ?? null,
        exampleSentenceHangul: data.exampleSentenceHangul ?? null,
        exampleSentenceVi: data.exampleSentenceVi ?? null,
        displayOrder,
      },
      });
    });
  }

  async updateVocabulary(id: string, data: Partial<VocabularyFormData>) {
    return withSerializableRetry(async (tx) => {
      const existing = await tx.vocabulary.findUniqueOrThrow({ where: { id } });
      await moveDisplayOrder(tx, "vocabulary", existing.lessonId, id, data.displayOrder);
      return tx.vocabulary.update({
      where: { id },
      data: {
        ...(data.hangul !== undefined && { hangul: data.hangul }),
        ...(data.romanization !== undefined && { romanization: data.romanization }),
        ...(data.vietnameseMeaning !== undefined && { vietnameseMeaning: data.vietnameseMeaning }),
        ...(data.englishMeaning !== undefined && { englishMeaning: data.englishMeaning ?? "" }),
        ...(data.partOfSpeech !== undefined && { partOfSpeech: data.partOfSpeech }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.tags !== undefined && { tags: data.tags }),
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
    });
  }

  async deleteVocabulary(id: string) {
    return withSerializableRetry(async (tx) => {
      const word = await tx.vocabulary.findUniqueOrThrow({ where: { id } });
      if (await tx.reviewCard.count({ where: { vocabularyId: id } })) throw new ConflictError("Từ vựng đang được sử dụng trong SRS.");
      const blocks = await tx.lessonBlock.findMany({ where: { lessonId: word.lessonId, type: "VOCABULARY" } });
      if (blocks.some((block) => {
        const content = block.content;
        return content && typeof content === "object" && !Array.isArray(content) &&
          Array.isArray(content.vocabularyIds) && content.vocabularyIds.includes(id);
      })) throw new ConflictError("Từ vựng đang được tham chiếu trong khối nội dung. Bỏ chọn từ trong khối trước khi xóa.");
      return tx.vocabulary.delete({ where: { id } });
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
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: {
        questions: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          include: {
            options: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
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
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          include: {
            options: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
            _count: { select: { attemptAnswers: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });
  }

  async createExercise(data: ExerciseFormData) {
    return withSerializableRetry(async (tx) => {
      const lesson = await tx.lesson.findUniqueOrThrow({ where: { id: data.lessonId } });
      if (lesson.status === "PUBLISHED" && data.status === "PUBLISHED") throw new ValidationError("Tạo bài tập nháp, thêm câu hỏi rồi xuất bản bài tập.");
      const displayOrder = await insertDisplayOrder(tx, "exercise", data.lessonId, data.displayOrder);
      return tx.exercise.create({
      data: {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? "DRAFT",
        displayOrder,
      },
      });
    });
  }

  async updateExercise(id: string, data: Partial<ExerciseFormData>) {
    return withSerializableRetry(async (tx) => {
      const existing = await tx.exercise.findUniqueOrThrow({ where: { id }, include: { questions: { include: { options: true } } } });
      if ((data.status ?? existing.status) === "PUBLISHED") {
        if (!existing.questions.length) throw new ValidationError("Thêm ít nhất một câu hỏi trước khi xuất bản bài tập.");
        for (const question of existing.questions) {
          if (isManualQuestion(question.type)) throw new ValidationError("Bài tập chấm thủ công cần giữ bản nháp cho đến khi có quy trình duyệt điểm.");
          const validation = QuestionFormSchema.safeParse(question);
          if (!validation.success) throw new ValidationError("Câu hỏi chưa hợp lệ để xuất bản.", validation.error.format());
        }
      }
      await moveDisplayOrder(tx, "exercise", existing.lessonId, id, data.displayOrder);
      return tx.exercise.update({ where: { id }, data });
    });
  }

  async deleteExercise(id: string) {
    return withSerializableRetry(async (tx) => {
      if (await tx.exerciseAttempt.count({ where: { exerciseId: id } })) throw new ConflictError("Không thể xóa bài tập đã có lượt làm bài.");
      return tx.exercise.delete({ where: { id } });
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
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: {
        options: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
        _count: { select: { attemptAnswers: true } },
      },
    });
  }

  async findQuestionById(id: string) {
    return prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
        _count: { select: { attemptAnswers: true } },
      },
    });
  }

  async createQuestion(data: QuestionFormData) {
    return withSerializableRetry(async (tx) => {
      const exercise = await tx.exercise.findUniqueOrThrow({ where: { id: data.exerciseId } });
      if (exercise.status === "PUBLISHED" && isManualQuestion(data.type)) throw new ValidationError("Câu chấm thủ công chỉ được lưu trong bài tập nháp.");
      if (await tx.exerciseAttempt.count({ where: { exerciseId: data.exerciseId, submittedAt: { not: null } } })) throw new ConflictError("Không thể thêm câu hỏi vì bài tập đã có lượt nộp.");
      const displayOrder = await insertDisplayOrder(tx, "question", data.exerciseId, data.displayOrder);
      const question = await tx.question.create({
        data: {
          exerciseId: data.exerciseId,
          type: data.type,
          prompt: data.prompt,
          audioUrl: data.audioUrl ?? null,
          correctAnswer: data.correctAnswer ?? null,
          content: data.content as Prisma.InputJsonValue,
          explanation: data.explanation ?? null,
          displayOrder,
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
          options: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
        },
      });
    });
  }

  async updateQuestion(id: string, data: QuestionPatchData) {
    return withSerializableRetry(async (tx) => {
      const existing = await tx.question.findUniqueOrThrow({ where: { id }, include: { exercise: true, options: true } });
      if (await tx.exerciseAttempt.count({ where: { exerciseId: existing.exerciseId, submittedAt: { not: null } } })) throw new ConflictError("Không thể sửa câu hỏi vì bài tập đã có lượt nộp.");
      if (existing.exercise.status === "PUBLISHED" && isManualQuestion(data.type ?? existing.type)) throw new ValidationError("Câu chấm thủ công chỉ được lưu trong bài tập nháp.");
      const retainedIds = data.options?.flatMap((option) => option.id ? [option.id] : []) ?? [];
      if (new Set(retainedIds).size !== retainedIds.length || retainedIds.some((optionId) => !existing.options.some((option) => option.id === optionId))) {
        throw new ValidationError("ID lựa chọn phải duy nhất và thuộc câu hỏi đang sửa.");
      }
      await moveDisplayOrder(tx, "question", existing.exerciseId, id, data.displayOrder);
      await tx.question.update({
        where: { id },
        data: {
          ...(data.type && { type: data.type }),
          ...(data.prompt !== undefined && { prompt: data.prompt }),
          ...(data.audioUrl !== undefined && { audioUrl: data.audioUrl }),
          ...(data.correctAnswer !== undefined && { correctAnswer: data.correctAnswer }),
          ...(data.content !== undefined && { content: data.content as Prisma.InputJsonValue }),
          ...(data.explanation !== undefined && { explanation: data.explanation }),
          ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        },
      });

      if (data.options !== undefined) {
        await tx.questionOption.deleteMany({
          where: { questionId: id, id: { notIn: retainedIds } },
        });
        for (const [index, option] of data.options.entries()) {
          const optionData = { text: option.text, isCorrect: option.isCorrect,
            explanation: option.explanation ?? null, displayOrder: option.displayOrder ?? index };
          if (option.id) await tx.questionOption.update({ where: { id: option.id }, data: optionData });
          else await tx.questionOption.create({ data: { ...optionData, questionId: id } });
        }
      }

      return tx.question.findUnique({
        where: { id },
        include: {
          options: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
        },
      });
    });
  }

  async deleteQuestion(id: string) {
    return withSerializableRetry(async (tx) => {
      const question = await tx.question.findUniqueOrThrow({ where: { id }, include: { exercise: { include: { lesson: true } } } });
      if (await tx.exerciseAttempt.count({ where: { exerciseId: question.exerciseId, submittedAt: { not: null } } })) throw new ConflictError("Không thể xóa câu hỏi vì bài tập đã có lượt nộp.");
      if (question.exercise.status === "PUBLISHED" && question.exercise.lesson.status === "PUBLISHED" &&
        await tx.question.count({ where: { exerciseId: question.exerciseId } }) === 1) throw new ConflictError("Chuyển bài tập sang bản nháp trước khi xóa câu hỏi cuối cùng.");
      return tx.question.delete({ where: { id } });
    });
  }

  async countSubmittedAttemptsForExercise(exerciseId: string): Promise<number> {
    return prisma.exerciseAttempt.count({
      where: { exerciseId, submittedAt: { not: null } },
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
    return withSerializableRetry(async (tx) => {
      await swapDisplayOrder(tx, model, itemA, itemB);
    });
  }
}

export const adminRepository = new AdminRepository();
