import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { prisma } from "../src/shared/db/prisma";

async function register(page: Page, prefix: string) {
  const email = `${prefix}-${randomUUID()}@example.com`;
  await page.goto("/dang-ky");
  await page.fill("#name", "Lesson authoring tester"); await page.fill("#email", email);
  await page.fill("#password", "Password123!"); await page.fill("#confirmPassword", "Password123!");
  await page.getByRole("button", { name: "Đăng ký tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

test("authors objectives, vocabulary references and a typed quiz; student completes the published lesson", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", (dialog) => dialog.accept());
  const users: string[] = [];
  const courseId = randomUUID(), courseSlug = `author-${courseId}`, lessonSlug = `author-${randomUUID()}`;
  let created = false;
  try {
    const admin = await register(page, "author-admin"); users.push(admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
    const course = await prisma.course.create({ data: { id: courseId, title: "Authoring course", slug: courseSlug, description: "Authoring", status: "PUBLISHED",
      chapters: { create: { title: "Chapter", slug: "chapter", status: "PUBLISHED", lessons: { create: { title: "Authoring lesson", slug: lessonSlug } } } } },
      include: { chapters: { include: { lessons: true } } } }); created = true;
    const lessonId = course.chapters[0].lessons[0].id;
    await page.goto(`/admin/lessons/${lessonId}/edit`);
    expect(await page.locator("h2").allTextContents()).toEqual([
      "1. Thông tin chung bài học", "2. Mục tiêu bài học", "3. Khối nội dung bài giảng (0)", "4. Ngân hàng từ vựng (0)", "5. Bài tập & câu hỏi chấm điểm (0)",
    ]);
    await page.getByRole("button", { name: "+ Thêm mục tiêu", exact: true }).click();
    await page.getByLabel("Mục tiêu 1", { exact: true }).fill("Nhận biết từ 아이.");
    await page.getByRole("button", { name: "Lưu mục tiêu", exact: true }).click();
    await expect(page.getByText("Đã lưu mục tiêu bài học.")).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "+ Thêm từ vựng", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Từ tiếng Hàn (Hangeul)", { exact: true }).fill("아이");
    await dialog.getByLabel("Phiên âm", { exact: true }).fill("ai");
    await dialog.getByLabel("Nghĩa tiếng Việt", { exact: true }).fill("Em bé");
    await dialog.getByLabel("Độ khó", { exact: true }).selectOption("1");
    await dialog.getByRole("button", { name: "Lưu từ vựng", exact: true }).click();
    await expect(dialog).toHaveCount(0); await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "+ Thêm khối nội dung", exact: true }).click();
    await dialog.getByLabel("Loại khối nội dung", { exact: true }).selectOption("VOCABULARY");
    await dialog.getByLabel("Tiêu đề khối", { exact: true }).fill("Từ đã học");
    await dialog.getByRole("checkbox", { name: /아이 — Em bé/ }).check();
    await dialog.getByRole("button", { name: "Lưu khối nội dung", exact: true }).click();
    await expect(dialog).toHaveCount(0); await page.waitForLoadState("networkidle");
    const block = await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId } });
    const word = await prisma.vocabulary.findFirstOrThrow({ where: { lessonId } });
    expect(block.content).toEqual({ title: "Từ đã học", vocabularyIds: [word.id] });
    expect((await page.request.delete(`/api/admin/vocabularies/${word.id}`)).status()).toBe(409);

    await page.getByRole("button", { name: "+ Thêm bài tập", exact: true }).click();
    await dialog.getByLabel("Tiêu đề bài tập", { exact: true }).fill("Nhận biết từ đã học");
    await dialog.getByRole("button", { name: "Lưu bài tập", exact: true }).click();
    await expect(dialog).toHaveCount(0); await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "+ Thêm câu hỏi", exact: true }).click();
    await dialog.getByLabel("Loại câu hỏi", { exact: true }).selectOption("TRUE_FALSE");
    await dialog.getByLabel("Đề bài câu hỏi", { exact: true }).fill("아이 có nghĩa là em bé.");
    await dialog.getByLabel("Đáp án đúng", { exact: true }).selectOption("true");
    await dialog.getByRole("button", { name: "Lưu câu hỏi", exact: true }).click();
    await expect(dialog).toHaveCount(0); await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Sửa bài tập", exact: true }).click();
    await dialog.getByLabel("Trạng thái bài tập", { exact: true }).selectOption("PUBLISHED");
    await dialog.getByRole("button", { name: "Lưu bài tập", exact: true }).click();
    await expect(dialog).toHaveCount(0); await page.waitForLoadState("networkidle");
    await page.getByLabel("Trạng thái xuất bản", { exact: true }).selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Lưu thông tin bài học", exact: true }).click();
    await expect(page.getByText("Đã lưu thông tin bài học.")).toBeVisible();
    await page.waitForLoadState("networkidle"); await page.reload();
    await expect(page.getByLabel("Mục tiêu 1", { exact: true })).toHaveValue("Nhận biết từ 아이.");
    await expect(page.getByLabel("Trạng thái xuất bản", { exact: true })).toHaveValue("PUBLISHED");
    await expect(page.getByText("1 từ vựng", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: ".temp/lesson-detail-mobile.png", fullPage: true });

    await page.goto("/dashboard"); await page.getByRole("button", { name: /Đăng xuất/ }).first().click();
    await expect(page).toHaveURL(/dang-nhap|\/$/);
    const student = await register(page, "author-student"); users.push(student.id);
    expect((await page.request.post(`/api/courses/${courseId}/enroll`)).status()).toBe(200);
    await page.goto(`/courses/${courseSlug}/lessons/${lessonSlug}`);
    await expect(page.getByText("Nhận biết từ 아이.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Đúng", exact: true }).click();
    await page.getByRole("button", { name: "Nộp bài tập", exact: true }).click();
    await page.getByRole("button", { name: "Nộp bài ngay", exact: true }).click();
    await expect(page.getByRole("heading", { name: "100%", exact: true })).toBeVisible();
    expect(await prisma.reviewCard.count({ where: { userId: student.id, vocabularyId: word.id } })).toBe(1);
    expect((await prisma.lessonProgress.findFirstOrThrow({ where: { userId: student.id, lessonId } })).status).toBe("COMPLETED");
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (created) await prisma.course.delete({ where: { id: courseId } });
  }
});
