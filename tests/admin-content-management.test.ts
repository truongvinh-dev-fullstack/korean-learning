import "dotenv/config";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ContentStatus, BlockType, QuestionType } from "@prisma/client";
import { adminService } from "@/modules/admin/admin.service";
import { lessonService } from "@/modules/lessons/lesson.service";
import { prisma } from "@/shared/db/prisma";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "@/shared/errors/domain-errors";

describe("Phase 8: Content Administration (RBAC, Validation, Safe Deletion & CRUD)", () => {
  const adminUser = { id: "admin-test-user-id", role: "ADMIN" };
  const studentUser = { id: "student-test-user-id", role: "STUDENT" };
  const unauthUser = null;

  let testCourseId: string;
  let testChapterId: string;
  const createdCourseIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const ts = Date.now() + Math.floor(Math.random() * 10000);
    // Create base course and chapter for admin tests
    const course = await prisma.course.create({
      data: {
        id: `adm-test-course-${ts}`,
        title: `Khóa học Test ${ts}`,
        slug: `khoa-hoc-test-${ts}`,
        description: "Khóa học phục vụ kiểm thử quản trị",
        status: ContentStatus.PUBLISHED,
        displayOrder: 99,
      },
    });
    testCourseId = course.id;
    createdCourseIds.push(course.id);

    const chapter = await prisma.chapter.create({
      data: {
        id: `adm-test-chapter-${ts}`,
        courseId: course.id,
        title: `Chương Test ${ts}`,
        slug: `chuong-test-${ts}`,
        status: ContentStatus.PUBLISHED,
        displayOrder: 0,
      },
    });
    testChapterId = chapter.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
  });

  describe("1. Role-Based Access Control (Strict Server-Side Authorization)", () => {
    it("rejects unauthenticated requests with UnauthorizedError (401)", async () => {
      await expect(adminService.getAllCourses(unauthUser)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(
        adminService.createCourse(unauthUser, {
          title: "Test Course",
          slug: "test-course",
          description: "Test",
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("strictly rejects STUDENT callers with ForbiddenError (403) across all admin operations", async () => {
      // 1. Courses
      await expect(adminService.getAllCourses(studentUser)).rejects.toThrow(
        ForbiddenError
      );
      await expect(
        adminService.createCourse(studentUser, {
          title: "Khóa học học viên tự tạo",
          slug: "student-course",
          description: "Hacker attempt",
        })
      ).rejects.toThrow(ForbiddenError);

      // 2. Chapters
      await expect(
        adminService.createChapter(studentUser, {
          courseId: testCourseId,
          title: "Chương học trái phép",
          slug: "chuong-trai-phep",
        })
      ).rejects.toThrow(ForbiddenError);

      // 3. Lessons
      await expect(
        adminService.createLesson(studentUser, {
          chapterId: testChapterId,
          title: "Bài học trái phép",
          slug: "bai-hoc-trai-phep",
        })
      ).rejects.toThrow(ForbiddenError);

      // 4. Blocks
      await expect(
        adminService.createBlock(studentUser, {
          lessonId: "any-id",
          type: BlockType.TEXT,
          content: { markdown: "Hack" },
        })
      ).rejects.toThrow(ForbiddenError);

      // 5. Exercises & Questions
      await expect(
        adminService.createExercise(studentUser, {
          lessonId: "any-id",
          title: "Bài tập trái phép",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("permits ADMIN caller to execute admin services", async () => {
      const courses = await adminService.getAllCourses(adminUser);
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.length).toBeGreaterThan(0);
    });
  });

  describe("2. Validation & Unique Slug Rules", () => {
    it("rejects malformed course slug with ValidationError", async () => {
      await expect(
        adminService.createCourse(adminUser, {
          title: "Khóa học lỗi slug",
          slug: "SLUG IN HOA VA CO KHOANG TRANG!",
          description: "Mô tả",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("prevents duplicate course slugs with ConflictError", async () => {
      const slug = `dup-course-${Date.now()}`;
      await adminService.createCourse(adminUser, {
        title: "Khóa học 1",
        slug,
        description: "Mô tả 1",
      });

      await expect(
        adminService.createCourse(adminUser, {
          title: "Khóa học 2",
          slug,
          description: "Mô tả 2",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("prevents duplicate chapter slug within the same course", async () => {
      const chapterSlug = `dup-chapter-${Date.now()}`;
      await adminService.createChapter(adminUser, {
        courseId: testCourseId,
        title: "Chương 1",
        slug: chapterSlug,
      });

      await expect(
        adminService.createChapter(adminUser, {
          courseId: testCourseId,
          title: "Chương 2",
          slug: chapterSlug,
        })
      ).rejects.toThrow(ConflictError);
    });

    it("prevents duplicate lesson slug across all lessons", async () => {
      const lessonSlug = `dup-lesson-${Date.now()}`;
      await adminService.createLesson(adminUser, {
        chapterId: testChapterId,
        title: "Bài 1",
        slug: lessonSlug,
      });

      await expect(
        adminService.createLesson(adminUser, {
          chapterId: testChapterId,
          title: "Bài 2",
          slug: lessonSlug,
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("3. Safe Deletion Rules (Progress & Attempt Protection)", () => {
    it("prevents deleting a course when student enrollments exist", async () => {
      const ts = Date.now();
      const testStudent = await prisma.user.create({
        data: {
          id: `adm-student-enrolled-${ts}`,
          email: `adm_student_enrolled_${ts}@example.com`,
          name: "Học Viên Đã Đăng Ký",
          role: "STUDENT",
        },
      });
      createdUserIds.push(testStudent.id);

      await prisma.enrollment.create({
        data: {
          userId: testStudent.id,
          courseId: testCourseId,
        },
      });

      await expect(adminService.deleteCourse(adminUser, testCourseId)).rejects.toThrow(
        ConflictError
      );
    });

    it("prevents deleting a lesson when student progress exists", async () => {
      const ts = Date.now();
      const lesson = await adminService.createLesson(adminUser, {
        chapterId: testChapterId,
        title: `Bài học có tiến độ ${ts}`,
        slug: `bai-hoc-co-tien-do-${ts}`,
      });

      const testStudent = await prisma.user.create({
        data: {
          id: `adm-student-prog-${ts}`,
          email: `adm_student_prog_${ts}@example.com`,
          name: "Học Viên Tiến Độ",
          role: "STUDENT",
        },
      });
      createdUserIds.push(testStudent.id);

      await prisma.lessonProgress.create({
        data: {
          userId: testStudent.id,
          lessonId: lesson.id,
          status: "COMPLETED",
          score: 100,
        },
      });

      await expect(adminService.deleteLesson(adminUser, lesson.id)).rejects.toThrow(
        ConflictError
      );
    });

    it("prevents deleting vocabulary when enqueued in student SRS cards", async () => {
      const ts = Date.now();
      const lesson = await adminService.createLesson(adminUser, {
        chapterId: testChapterId,
        title: `Bài học từ vựng SRS ${ts}`,
        slug: `bai-hoc-tu-vung-srs-${ts}`,
      });

      const vocab = await adminService.createVocabulary(adminUser, {
        lessonId: lesson.id,
        hangul: "학교",
        romanization: "hakgyo",
        vietnameseMeaning: "Trường học",
      });

      const testStudent = await prisma.user.create({
        data: {
          id: `adm-student-srs-${ts}`,
          email: `adm_student_srs_${ts}@example.com`,
          name: "Học Viên SRS",
          role: "STUDENT",
        },
      });
      createdUserIds.push(testStudent.id);

      await prisma.reviewCard.create({
        data: {
          userId: testStudent.id,
          vocabularyId: vocab.id,
        },
      });

      await expect(adminService.deleteVocabulary(adminUser, vocab.id)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe("4. Reorder Controls (Simple Move Up/Down without Drag-and-Drop)", () => {
    it("swaps display order between adjacent lessons correctly", async () => {
      const ts = Date.now();
      const lessonA = await adminService.createLesson(adminUser, {
        chapterId: testChapterId,
        title: `Bài A ${ts}`,
        slug: `bai-a-${ts}`,
        displayOrder: 1,
      });

      const lessonB = await adminService.createLesson(adminUser, {
        chapterId: testChapterId,
        title: `Bài B ${ts}`,
        slug: `bai-b-${ts}`,
        displayOrder: 2,
      });

      expect(lessonA.displayOrder).toBe(1);
      expect(lessonB.displayOrder).toBe(2);

      // Move lessonB UP (swaps with lessonA)
      await adminService.reorderLesson(adminUser, lessonB.id, { direction: "UP" });

      const updatedA = await adminService.getLessonById(adminUser, lessonA.id);
      const updatedB = await adminService.getLessonById(adminUser, lessonB.id);

      expect(updatedB.displayOrder).toBe(1);
      expect(updatedA.displayOrder).toBe(2);
    });
  });

  describe("5. Complete End-to-End Draft -> Preview -> Publish -> Student Access Lifecycle", () => {
    it("creates draft lesson, previews it, publishes it, verifies student access and edits again", async () => {
      const ts = Date.now();
      const slug = `bai-hoc-lifecycle-${ts}`;
      const learner = await prisma.user.create({ data: { id: crypto.randomUUID(), email: `admin-lifecycle-${ts}@example.com`, name: "Lifecycle learner" } });
      createdUserIds.push(learner.id);

      // 1. Admin creates a DRAFT lesson
      const draftLesson = await adminService.createLesson(adminUser, {
        chapterId: testChapterId,
        title: `Bài học Vòng đời ${ts}`,
        slug,
        summary: "Tóm tắt bài học thử nghiệm",
        estimatedMinutes: 20,
        status: ContentStatus.DRAFT,
      });
      expect(draftLesson.status).toBe(ContentStatus.DRAFT);

      // 2. Admin adds a TEXT block and AUDIO block to the draft lesson
      const textBlock = await adminService.createBlock(adminUser, {
        lessonId: draftLesson.id,
        type: BlockType.TEXT,
        content: {
          title: "Khái niệm mở đầu",
          markdown: "Chào mừng các bạn đến với bài học thử nghiệm.",
        },
      });
      expect(textBlock.id).toBeDefined();

      const audioBlock = await adminService.createBlock(adminUser, {
        lessonId: draftLesson.id,
        type: BlockType.AUDIO,
        content: {
          audioUrl: "/audio/sample-hangul.mp3",
          title: "Phát âm mẫu",
        },
      });
      expect(audioBlock.id).toBeDefined();

      // 3. Admin adds vocabulary to the draft lesson
      const vocab = await adminService.createVocabulary(adminUser, {
        lessonId: draftLesson.id,
        hangul: "선생님",
        romanization: "seonsaengnim",
        vietnameseMeaning: "Thầy/cô giáo",
        englishMeaning: "Teacher",
        audioUrl: "/audio/vocab/teacher.mp3",
      });
      expect(vocab.hangul).toBe("선생님");

      // 4. Admin adds exercise & question
      const exercise = await adminService.createExercise(adminUser, {
        lessonId: draftLesson.id,
        title: "Bài tập thử nghiệm",
      });

      const question = await adminService.createQuestion(adminUser, {
        exerciseId: exercise.id,
        type: QuestionType.MULTIPLE_CHOICE,
        prompt: "Nghĩa của từ '선생님' là gì?",
        options: [
          { text: "Học sinh", isCorrect: false },
          { text: "Thầy/cô giáo", isCorrect: true },
          { text: "Bác sĩ", isCorrect: false },
          { text: "Nhân viên", isCorrect: false },
        ],
      });
      expect(question?.options.length).toBe(4);

      // 5. Admin can PREVIEW the draft lesson before publishing
      const previewData = await adminService.getLessonPreview(adminUser, draftLesson.id);
      expect(previewData.id).toBe(draftLesson.id);
      expect(previewData.blocks.length).toBe(2);
      expect(previewData.vocabularies.length).toBe(1);
      expect(previewData.exercises.length).toBe(1);

      // 6. Student CANNOT view draft lesson
      const studentViewBeforePublish = await lessonService.getPublishedLessonBySlug(slug, learner.id);
      expect(studentViewBeforePublish).toBeNull();

      // 7. Admin PUBLISHES the lesson
      const publishedLesson = await adminService.updateLesson(adminUser, draftLesson.id, {
        status: ContentStatus.PUBLISHED,
      });
      expect(publishedLesson.status).toBe(ContentStatus.PUBLISHED);

      // 8. Student CAN now access and view the published lesson
      await prisma.enrollment.create({ data: { userId: learner.id, courseId: testCourseId } });
      const studentViewAfterPublish = await lessonService.getPublishedLessonBySlug(slug, learner.id);
      expect(studentViewAfterPublish).not.toBeNull();
      expect(studentViewAfterPublish?.title).toBe(draftLesson.title);

      // 9. Admin EDITS the published lesson again (title update)
      const editedTitle = `Bài học Vòng đời đã cập nhật ${ts}`;
      const reEditedLesson = await adminService.updateLesson(adminUser, draftLesson.id, {
        title: editedTitle,
        estimatedMinutes: 25,
      });
      expect(reEditedLesson.title).toBe(editedTitle);
      expect(reEditedLesson.estimatedMinutes).toBe(25);

      // 10. Student sees the updated title immediately
      const studentViewUpdated = await lessonService.getPublishedLessonBySlug(slug, learner.id);
      expect(studentViewUpdated?.title).toBe(editedTitle);
    });
  });
});
