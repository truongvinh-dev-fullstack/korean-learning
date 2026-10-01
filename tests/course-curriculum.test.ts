import "dotenv/config";
import { describe, it, expect } from "vitest";
import { courseService } from "@/modules/courses/course.service";
import { lessonService } from "@/modules/lessons/lesson.service";
import { prisma } from "@/shared/db/prisma";

describe("Course & Curriculum Service", () => {
  it("retrieves published course catalog with correct counts", async () => {
    const catalog = await courseService.getPublishedCatalog();

    expect(catalog.length).toBeGreaterThanOrEqual(1);
    const flagshipCourse = catalog.find((c) => c.slug === "tieng-han-tu-con-so-0");

    expect(flagshipCourse).toBeDefined();
    expect(flagshipCourse?.title).toBe("Tiếng Hàn từ con số 0");
    expect(flagshipCourse?.chapterCount).toBe(3);
    expect(flagshipCourse?.lessonCount).toBe(3);
    expect(flagshipCourse?.estimatedMinutes).toBe(55);
  });

  it("retrieves course by slug with ordered chapters and lessons", async () => {
    const course = await courseService.getCourseBySlug("tieng-han-tu-con-so-0");

    expect(course).not.toBeNull();
    expect(course?.slug).toBe("tieng-han-tu-con-so-0");
    expect(course?.chapters).toHaveLength(3);

    // Verify ordering
    expect(course?.chapters[0].displayOrder).toBe(1);
    expect(course?.chapters[1].displayOrder).toBe(2);
    expect(course?.chapters[2].displayOrder).toBe(3);

    // Verify lessons within Chapter 1
    const ch1 = course?.chapters[0];
    expect(ch1?.lessons).toHaveLength(3);
    expect(ch1?.lessons[0].displayOrder).toBe(1);
    expect(ch1?.lessons[1].displayOrder).toBe(2);
    expect(ch1?.lessons[2].displayOrder).toBe(3);
  });

  it("retrieves published lesson by slug with validated blocks and vocabulary", async () => {
    const user = await prisma.user.create({ data: { id: crypto.randomUUID(), email: `curriculum-${crypto.randomUUID()}@example.com`, name: "Curriculum tester" } });
    const course = await prisma.course.findUniqueOrThrow({ where: { slug: "tieng-han-tu-con-so-0" } });
    await prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
    const lesson = await lessonService.getPublishedLessonBySlug("bai-1-nguyen-am-co-ban", user.id);

    expect(lesson).not.toBeNull();
    expect(lesson?.slug).toBe("bai-1-nguyen-am-co-ban");
    expect(lesson?.chapter.course.slug).toBe("tieng-han-tu-con-so-0");

    // Check blocks
    expect(lesson?.blocks.length).toBeGreaterThanOrEqual(5);

    // Check vocabularies
    expect(lesson?.vocabularies.length).toBeGreaterThanOrEqual(5);
    expect(lesson?.vocabularies[0].hangul).toBe("아이");
    expect(lesson?.vocabularies[1].hangul).toBe("오이");
  });

  it("returns null for non-existent course or lesson slug", async () => {
    const nonExistentCourse = await courseService.getCourseBySlug("slug-khong-ton-tai");
    expect(nonExistentCourse).toBeNull();

    const nonExistentLesson = await lessonService.getPublishedLessonBySlug("bai-khong-ton-tai", null);
    expect(nonExistentLesson).toBeNull();
  });
});
