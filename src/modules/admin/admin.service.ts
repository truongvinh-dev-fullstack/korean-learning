import { assertAdminRole } from "@/shared/auth/roles";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/shared/errors/domain-errors";
import { adminRepository, AdminRepository } from "./admin.repository";
import {
  CourseFormSchema,
  ChapterFormSchema,
  LessonFormSchema,
  LessonBlockFormSchema,
  VocabularyFormSchema,
  ExerciseFormSchema,
  QuestionFormSchema,
  QuestionPatchSchema,
  ReorderSchema,
} from "./admin.schema";
import { prisma } from "@/shared/db/prisma";

export class AdminService {
  constructor(private readonly repo: AdminRepository = adminRepository) {}

  // ==========================================
  // DASHBOARD METRICS & USER MANAGEMENT
  // ==========================================
  async getAdminDashboardMetrics(
    sessionUser: { role?: string | null } | null | undefined
  ) {
    assertAdminRole(sessionUser);

    const [
      userCount,
      courseCount,
      chapterCount,
      lessonCount,
      exerciseCount,
      vocabCount,
      users,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.chapter.count(),
      prisma.lesson.count(),
      prisma.exercise.count(),
      prisma.vocabulary.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      userCount,
      courseCount,
      chapterCount,
      lessonCount,
      exerciseCount,
      vocabCount,
      recentUsers: users,
    };
  }

  async promoteUserToAdmin(
    sessionUserOrEmail: { role?: string | null } | string | null | undefined,
    maybeEmail?: string
  ) {
    let emailToPromote: string;
    if (typeof sessionUserOrEmail === "string") {
      emailToPromote = sessionUserOrEmail;
    } else {
      assertAdminRole(sessionUserOrEmail);
      if (!maybeEmail) {
        throw new ValidationError("Thiếu email người dùng cần phân quyền.");
      }
      emailToPromote = maybeEmail;
    }

    const trimmedEmail = emailToPromote.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!existing) {
      throw new NotFoundError(
        `Người dùng với email "${trimmedEmail}" không tồn tại trong hệ thống.`
      );
    }

    return prisma.user.update({
      where: { email: trimmedEmail },
      data: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  // ==========================================
  // COURSES
  // ==========================================
  async getAllCourses(sessionUser: { role?: string | null } | null | undefined) {
    assertAdminRole(sessionUser);
    return this.repo.findAllCourses();
  }

  async getCourseById(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);
    const course = await this.repo.findCourseById(id);
    if (!course) {
      throw new NotFoundError("Không tìm thấy khóa học này.");
    }
    return course;
  }

  async createCourse(
    sessionUser: { role?: string | null } | null | undefined,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const parsed = CourseFormSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu khóa học không hợp lệ.", parsed.error.format());
    }

    const existingSlug = await this.repo.findCourseBySlug(parsed.data.slug);
    if (existingSlug) {
      throw new ConflictError(
        `Slug khóa học "${parsed.data.slug}" đã tồn tại. Vui lòng chọn slug khác.`
      );
    }

    const displayOrder =
      parsed.data.displayOrder !== undefined && parsed.data.displayOrder > 0
        ? parsed.data.displayOrder
        : await this.repo.getNextCourseDisplayOrder();

    return this.repo.createCourse({
      ...parsed.data,
      displayOrder,
    });
  }

  async updateCourse(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findCourseById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy khóa học để chỉnh sửa.");
    }

    const parsed = CourseFormSchema.partial().safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu cập nhật không hợp lệ.", parsed.error.format());
    }

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const slugCheck = await this.repo.findCourseBySlug(parsed.data.slug);
      if (slugCheck && slugCheck.id !== id) {
        throw new ConflictError(
          `Slug khóa học "${parsed.data.slug}" đã tồn tại trên hệ thống.`
        );
      }
    }

    return this.repo.updateCourse(id, parsed.data);
  }

  async deleteCourse(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findCourseById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy khóa học để xóa.");
    }

    return this.repo.deleteCourse(id);
  }

  async reorderCourse(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawDirection: unknown
  ) {
    assertAdminRole(sessionUser);
    const parsed = ReorderSchema.safeParse(rawDirection);
    if (!parsed.success) {
      throw new ValidationError("Hướng di chuyển không hợp lệ.");
    }

    const courses = await this.repo.findAllCourses();
    const index = courses.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new NotFoundError("Không tìm thấy khóa học.");
    }

    const targetIndex = parsed.data.direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= courses.length) {
      return courses; // Already at edge
    }

    await this.repo.swapOrder(
      "course",
      { id: courses[index].id, displayOrder: courses[index].displayOrder },
      { id: courses[targetIndex].id, displayOrder: courses[targetIndex].displayOrder }
    );

    return this.repo.findAllCourses();
  }

  // ==========================================
  // CHAPTERS
  // ==========================================
  async getChaptersByCourseId(
    sessionUser: { role?: string | null } | null | undefined,
    courseId: string
  ) {
    assertAdminRole(sessionUser);
    return this.repo.findChaptersByCourseId(courseId);
  }

  async getChapterById(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);
    const chapter = await this.repo.findChapterById(id);
    if (!chapter) {
      throw new NotFoundError("Không tìm thấy chương học này.");
    }
    return chapter;
  }

  async createChapter(
    sessionUser: { role?: string | null } | null | undefined,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const parsed = ChapterFormSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu chương học không hợp lệ.", parsed.error.format());
    }

    const existingCourse = await this.repo.findCourseById(parsed.data.courseId);
    if (!existingCourse) {
      throw new NotFoundError("Khóa học tương ứng không tồn tại.");
    }

    const duplicateSlug = await this.repo.findChapterByCourseAndSlug(
      parsed.data.courseId,
      parsed.data.slug
    );
    if (duplicateSlug) {
      throw new ConflictError(
        `Slug chương "${parsed.data.slug}" đã tồn tại trong khóa học này.`
      );
    }

    const displayOrder =
      parsed.data.displayOrder !== undefined && parsed.data.displayOrder > 0
        ? parsed.data.displayOrder
        : await this.repo.getNextChapterDisplayOrder(parsed.data.courseId);

    return this.repo.createChapter({
      ...parsed.data,
      displayOrder,
    });
  }

  async updateChapter(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findChapterById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy chương học để cập nhật.");
    }

    const parsed = ChapterFormSchema.partial().safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu cập nhật chương không hợp lệ.", parsed.error.format());
    }

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const courseId = parsed.data.courseId || existing.courseId;
      const dup = await this.repo.findChapterByCourseAndSlug(courseId, parsed.data.slug);
      if (dup && dup.id !== id) {
        throw new ConflictError(
          `Slug chương "${parsed.data.slug}" đã tồn tại trong khóa học này.`
        );
      }
    }

    return this.repo.updateChapter(id, parsed.data);
  }

  async deleteChapter(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findChapterById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy chương học để xóa.");
    }

    return this.repo.deleteChapter(id);
  }

  async reorderChapter(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawDirection: unknown
  ) {
    assertAdminRole(sessionUser);
    const parsed = ReorderSchema.safeParse(rawDirection);
    if (!parsed.success) {
      throw new ValidationError("Hướng di chuyển không hợp lệ.");
    }

    const chapter = await this.repo.findChapterById(id);
    if (!chapter) {
      throw new NotFoundError("Không tìm thấy chương học.");
    }

    const chapters = await this.repo.findChaptersByCourseId(chapter.courseId);
    const index = chapters.findIndex((c) => c.id === id);
    if (index === -1) return chapters;

    const targetIndex = parsed.data.direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) {
      return chapters;
    }

    await this.repo.swapOrder(
      "chapter",
      { id: chapters[index].id, displayOrder: chapters[index].displayOrder },
      { id: chapters[targetIndex].id, displayOrder: chapters[targetIndex].displayOrder }
    );

    return this.repo.findChaptersByCourseId(chapter.courseId);
  }

  // ==========================================
  // LESSONS
  // ==========================================
  async getLessonsByChapterId(
    sessionUser: { role?: string | null } | null | undefined,
    chapterId: string
  ) {
    assertAdminRole(sessionUser);
    return this.repo.findLessonsByChapterId(chapterId);
  }

  async getLessonById(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);
    const lesson = await this.repo.findLessonById(id);
    if (!lesson) {
      throw new NotFoundError("Không tìm thấy bài học này.");
    }
    return lesson;
  }

  async getLessonPreview(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);
    const lesson = await this.repo.findLessonById(id);
    if (!lesson) {
      throw new NotFoundError("Không tìm thấy bài học để xem trước.");
    }
    return lesson;
  }

  async createLesson(
    sessionUser: { role?: string | null } | null | undefined,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const parsed = LessonFormSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu bài học không hợp lệ.", parsed.error.format());
    }

    const chapter = await this.repo.findChapterById(parsed.data.chapterId);
    if (!chapter) {
      throw new NotFoundError("Chương học tương ứng không tồn tại.");
    }

    const duplicateSlug = await this.repo.findLessonBySlug(parsed.data.slug);
    if (duplicateSlug) {
      throw new ConflictError(
        `Slug bài học "${parsed.data.slug}" đã được sử dụng. Vui lòng chọn slug khác.`
      );
    }

    const displayOrder =
      parsed.data.displayOrder !== undefined && parsed.data.displayOrder > 0
        ? parsed.data.displayOrder
        : await this.repo.getNextLessonDisplayOrder(parsed.data.chapterId);

    return this.repo.createLesson({
      ...parsed.data,
      displayOrder,
    });
  }

  async updateLesson(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findLessonById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy bài học để cập nhật.");
    }

    const parsed = LessonFormSchema.partial().safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu cập nhật bài học không hợp lệ.", parsed.error.format());
    }

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const dup = await this.repo.findLessonBySlug(parsed.data.slug);
      if (dup && dup.id !== id) {
        throw new ConflictError(
          `Slug bài học "${parsed.data.slug}" đã được sử dụng. Vui lòng chọn slug khác.`
        );
      }
    }

    return this.repo.updateLesson(id, parsed.data);
  }

  async deleteLesson(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findLessonById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy bài học để xóa.");
    }

    // Safe deletion checks: progress, attempts, srs cards
    const { progressCount, attemptsCount, srsCardCount } =
      await this.repo.getLessonStudentActivityCounts(id);

    if (progressCount > 0) {
      throw new ConflictError(
        `Không thể xóa bài học vì đã có ${progressCount} học viên tham gia học bài này.`
      );
    }

    if (attemptsCount > 0) {
      throw new ConflictError(
        `Không thể xóa bài học vì đã có ${attemptsCount} lượt làm bài tập của học viên.`
      );
    }

    if (srsCardCount > 0) {
      throw new ConflictError(
        `Không thể xóa bài học vì các từ vựng đã được nạp vào ${srsCardCount} thẻ ôn tập SRS của học viên.`
      );
    }

    return this.repo.deleteLesson(id);
  }

  async reorderLesson(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawDirection: unknown
  ) {
    assertAdminRole(sessionUser);
    const parsed = ReorderSchema.safeParse(rawDirection);
    if (!parsed.success) {
      throw new ValidationError("Hướng di chuyển không hợp lệ.");
    }

    const lesson = await this.repo.findLessonById(id);
    if (!lesson) {
      throw new NotFoundError("Không tìm thấy bài học.");
    }

    const lessons = await this.repo.findLessonsByChapterId(lesson.chapterId);
    const index = lessons.findIndex((l) => l.id === id);
    if (index === -1) return lessons;

    const targetIndex = parsed.data.direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) {
      return lessons;
    }

    await this.repo.swapOrder(
      "lesson",
      { id: lessons[index].id, displayOrder: lessons[index].displayOrder },
      { id: lessons[targetIndex].id, displayOrder: lessons[targetIndex].displayOrder }
    );

    return this.repo.findLessonsByChapterId(lesson.chapterId);
  }

  // ==========================================
  // LESSON BLOCKS
  // ==========================================
  async getBlocksByLessonId(
    sessionUser: { role?: string | null } | null | undefined,
    lessonId: string
  ) {
    assertAdminRole(sessionUser);
    return this.repo.findBlocksByLessonId(lessonId);
  }

  async createBlock(
    sessionUser: { role?: string | null } | null | undefined,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const parsed = LessonBlockFormSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu khối nội dung không hợp lệ.", parsed.error.format());
    }

    const lesson = await this.repo.findLessonById(parsed.data.lessonId);
    if (!lesson) {
      throw new NotFoundError("Bài học không tồn tại.");
    }

    const displayOrder =
      parsed.data.displayOrder !== undefined && parsed.data.displayOrder > 0
        ? parsed.data.displayOrder
        : await this.repo.getNextBlockDisplayOrder(parsed.data.lessonId);

    return this.repo.createBlock({
      ...parsed.data,
      displayOrder,
    });
  }

  async updateBlock(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findBlockById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy khối nội dung.");
    }

    const parsed = LessonBlockFormSchema.partial().safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu cập nhật khối nội dung không hợp lệ.", parsed.error.format());
    }

    return this.repo.updateBlock(id, parsed.data);
  }

  async deleteBlock(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findBlockById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy khối nội dung để xóa.");
    }

    return this.repo.deleteBlock(id);
  }

  async reorderBlock(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawDirection: unknown
  ) {
    assertAdminRole(sessionUser);
    const parsed = ReorderSchema.safeParse(rawDirection);
    if (!parsed.success) {
      throw new ValidationError("Hướng di chuyển không hợp lệ.");
    }

    const block = await this.repo.findBlockById(id);
    if (!block) {
      throw new NotFoundError("Không tìm thấy khối nội dung.");
    }

    const blocks = await this.repo.findBlocksByLessonId(block.lessonId);
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return blocks;

    const targetIndex = parsed.data.direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return blocks;
    }

    await this.repo.swapOrder(
      "lessonBlock",
      { id: blocks[index].id, displayOrder: blocks[index].displayOrder },
      { id: blocks[targetIndex].id, displayOrder: blocks[targetIndex].displayOrder }
    );

    return this.repo.findBlocksByLessonId(block.lessonId);
  }

  // ==========================================
  // VOCABULARY
  // ==========================================
  async getVocabulariesByLessonId(
    sessionUser: { role?: string | null } | null | undefined,
    lessonId: string
  ) {
    assertAdminRole(sessionUser);
    return this.repo.findVocabulariesByLessonId(lessonId);
  }

  async createVocabulary(
    sessionUser: { role?: string | null } | null | undefined,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const parsed = VocabularyFormSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu từ vựng không hợp lệ.", parsed.error.format());
    }

    const lesson = await this.repo.findLessonById(parsed.data.lessonId);
    if (!lesson) {
      throw new NotFoundError("Bài học không tồn tại.");
    }

    const displayOrder =
      parsed.data.displayOrder !== undefined && parsed.data.displayOrder > 0
        ? parsed.data.displayOrder
        : await this.repo.getNextVocabularyDisplayOrder(parsed.data.lessonId);

    return this.repo.createVocabulary({
      ...parsed.data,
      displayOrder,
    });
  }

  async updateVocabulary(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findVocabularyById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy từ vựng để cập nhật.");
    }

    const parsed = VocabularyFormSchema.partial().safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu cập nhật từ vựng không hợp lệ.", parsed.error.format());
    }

    return this.repo.updateVocabulary(id, parsed.data);
  }

  async deleteVocabulary(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findVocabularyById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy từ vựng để xóa.");
    }

    const srsCards = await this.repo.countReviewCardsForVocabulary(id);
    if (srsCards > 0) {
      throw new ConflictError(
        `Không thể xóa từ vựng vì đã có ${srsCards} thẻ ôn tập SRS của học viên đang sử dụng từ này.`
      );
    }

    return this.repo.deleteVocabulary(id);
  }

  async reorderVocabulary(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawDirection: unknown
  ) {
    assertAdminRole(sessionUser);
    const parsed = ReorderSchema.safeParse(rawDirection);
    if (!parsed.success) {
      throw new ValidationError("Hướng di chuyển không hợp lệ.");
    }

    const vocab = await this.repo.findVocabularyById(id);
    if (!vocab) {
      throw new NotFoundError("Không tìm thấy từ vựng.");
    }

    const vocabs = await this.repo.findVocabulariesByLessonId(vocab.lessonId);
    const index = vocabs.findIndex((v) => v.id === id);
    if (index === -1) return vocabs;

    const targetIndex = parsed.data.direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= vocabs.length) {
      return vocabs;
    }

    await this.repo.swapOrder(
      "vocabulary",
      { id: vocabs[index].id, displayOrder: vocabs[index].displayOrder },
      { id: vocabs[targetIndex].id, displayOrder: vocabs[targetIndex].displayOrder }
    );

    return this.repo.findVocabulariesByLessonId(vocab.lessonId);
  }

  // ==========================================
  // EXERCISES & QUESTIONS
  // ==========================================
  async getExercisesByLessonId(
    sessionUser: { role?: string | null } | null | undefined,
    lessonId: string
  ) {
    assertAdminRole(sessionUser);
    return this.repo.findExercisesByLessonId(lessonId);
  }

  async createExercise(
    sessionUser: { role?: string | null } | null | undefined,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const parsed = ExerciseFormSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu bài tập không hợp lệ.", parsed.error.format());
    }

    const lesson = await this.repo.findLessonById(parsed.data.lessonId);
    if (!lesson) {
      throw new NotFoundError("Bài học không tồn tại.");
    }

    const displayOrder =
      parsed.data.displayOrder !== undefined && parsed.data.displayOrder > 0
        ? parsed.data.displayOrder
        : await this.repo.getNextExerciseDisplayOrder(parsed.data.lessonId);

    return this.repo.createExercise({
      ...parsed.data,
      displayOrder,
    });
  }

  async updateExercise(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findExerciseById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy bài tập để cập nhật.");
    }

    const parsed = ExerciseFormSchema.partial().safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu cập nhật bài tập không hợp lệ.", parsed.error.format());
    }

    return this.repo.updateExercise(id, parsed.data);
  }

  async deleteExercise(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findExerciseById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy bài tập để xóa.");
    }

    const attempts = await this.repo.countAttemptsForExercise(id);
    if (attempts > 0) {
      throw new ConflictError(
        `Không thể xóa bài tập vì đã có ${attempts} lượt làm bài của học viên.`
      );
    }

    return this.repo.deleteExercise(id);
  }

  async reorderExercise(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawDirection: unknown
  ) {
    assertAdminRole(sessionUser);
    const parsed = ReorderSchema.safeParse(rawDirection);
    if (!parsed.success) {
      throw new ValidationError("Hướng di chuyển không hợp lệ.");
    }

    const ex = await this.repo.findExerciseById(id);
    if (!ex) {
      throw new NotFoundError("Không tìm thấy bài tập.");
    }

    const list = await this.repo.findExercisesByLessonId(ex.lessonId);
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) return list;

    const targetIndex = parsed.data.direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      return list;
    }

    await this.repo.swapOrder(
      "exercise",
      { id: list[index].id, displayOrder: list[index].displayOrder },
      { id: list[targetIndex].id, displayOrder: list[targetIndex].displayOrder }
    );

    return this.repo.findExercisesByLessonId(ex.lessonId);
  }

  async createQuestion(
    sessionUser: { role?: string | null } | null | undefined,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const parsed = QuestionFormSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu câu hỏi không hợp lệ.", parsed.error.format());
    }

    const exercise = await this.repo.findExerciseById(parsed.data.exerciseId);
    if (!exercise) {
      throw new NotFoundError("Bài tập không tồn tại.");
    }

    const displayOrder =
      parsed.data.displayOrder !== undefined && parsed.data.displayOrder > 0
        ? parsed.data.displayOrder
        : await this.repo.getNextQuestionDisplayOrder(parsed.data.exerciseId);

    return this.repo.createQuestion({
      ...parsed.data,
      displayOrder,
    });
  }

  async updateQuestion(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawData: unknown
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findQuestionById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy câu hỏi để cập nhật.");
    }

    if (await this.repo.countSubmittedAttemptsForExercise(existing.exerciseId)) {
      throw new ConflictError("Không thể sửa câu hỏi hoặc đáp án vì bài tập đã có lượt nộp.");
    }

    const parsed = QuestionPatchSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu cập nhật câu hỏi không hợp lệ.", parsed.error.format());
    }

    if (parsed.data.exerciseId && parsed.data.exerciseId !== existing.exerciseId) {
      throw new ValidationError("Không thể chuyển câu hỏi sang bài tập khác.");
    }
    const effective = QuestionFormSchema.safeParse({
      exerciseId: existing.exerciseId,
      type: parsed.data.type ?? existing.type,
      prompt: parsed.data.prompt ?? existing.prompt,
      audioUrl: parsed.data.audioUrl !== undefined ? parsed.data.audioUrl : existing.audioUrl,
      correctAnswer: parsed.data.correctAnswer !== undefined ? parsed.data.correctAnswer : existing.correctAnswer,
      explanation: parsed.data.explanation !== undefined ? parsed.data.explanation : existing.explanation,
      displayOrder: parsed.data.displayOrder ?? existing.displayOrder,
      options: parsed.data.options ?? existing.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        explanation: option.explanation,
        displayOrder: option.displayOrder,
      })),
    });
    if (!effective.success) {
      throw new ValidationError("Dữ liệu cập nhật câu hỏi không hợp lệ.", effective.error.format());
    }
    return this.repo.updateQuestion(id, parsed.data);
  }

  async deleteQuestion(
    sessionUser: { role?: string | null } | null | undefined,
    id: string
  ) {
    assertAdminRole(sessionUser);

    const existing = await this.repo.findQuestionById(id);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy câu hỏi để xóa.");
    }

    if (await this.repo.countSubmittedAttemptsForExercise(existing.exerciseId)) {
      throw new ConflictError("Không thể xóa câu hỏi hoặc đáp án vì bài tập đã có lượt nộp.");
    }

    return this.repo.deleteQuestion(id);
  }

  async reorderQuestion(
    sessionUser: { role?: string | null } | null | undefined,
    id: string,
    rawDirection: unknown
  ) {
    assertAdminRole(sessionUser);
    const parsed = ReorderSchema.safeParse(rawDirection);
    if (!parsed.success) {
      throw new ValidationError("Hướng di chuyển không hợp lệ.");
    }

    const question = await this.repo.findQuestionById(id);
    if (!question) {
      throw new NotFoundError("Không tìm thấy câu hỏi.");
    }

    const questions = await this.repo.findQuestionsByExerciseId(question.exerciseId);
    const index = questions.findIndex((q: { id: string }) => q.id === id);
    if (index === -1) return questions;

    const targetIndex = parsed.data.direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) {
      return questions;
    }

    await this.repo.swapOrder(
      "question",
      { id: questions[index].id, displayOrder: questions[index].displayOrder },
      { id: questions[targetIndex].id, displayOrder: questions[targetIndex].displayOrder }
    );

    return this.repo.findQuestionsByExerciseId(question.exerciseId);
  }
}

export const adminService = new AdminService();
