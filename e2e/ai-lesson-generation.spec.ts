import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { prisma } from "../src/shared/db/prisma";

async function setup(page: Page) {
  const email = `ai-e2e-${randomUUID()}@example.com`;
  await page.goto("/dang-ky"); await page.fill("#name", "AI QA"); await page.fill("#email", email); await page.fill("#password", "Password123!"); await page.fill("#confirmPassword", "Password123!");
  await page.getByRole("button", { name: "Đăng ký tài khoản", exact: true }).click(); await expect(page).toHaveURL(/dashboard/);
  const admin = await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  const course = await prisma.course.create({ data: { title: "AI E2E", slug: `ai-e2e-${randomUUID()}`, description: "AI", chapters: { create: { id: `legacy-chapter-${randomUUID()}`, title: "Chapter", slug: "chapter", lessons: { create: { id: `legacy-lesson-${randomUUID()}`, title: "Existing draft", slug: `existing-${randomUUID()}` } } } } }, include: { chapters: { include: { lessons: true } } } });
  const chapterId = course.chapters[0].id, lessonId = course.chapters[0].lessons[0].id;
  return { admin, chapterId, lessonId, cleanup: async () => { await prisma.aiLessonImport.deleteMany({ where: { userId: admin.id } }); await prisma.aiLessonGenerationLimit.deleteMany({ where: { userId: admin.id } }); await prisma.course.delete({ where: { id: course.id } }); await prisma.user.delete({ where: { id: admin.id } }); } };
}
async function generate(page: Page, lessonId: string, topic: string) {
  await page.goto(`/admin/lessons/${lessonId}/edit`); await page.getByRole("link", { name: "AI tạo bài học", exact: true }).click();
  await page.getByLabel("Chủ đề", { exact: true }).fill(topic);
  const generatedResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/ai-lessons/generate"));
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click(); await expect(page.getByTestId("ai-draft-preview")).toBeVisible();
  const response = await generatedResponse, result = await response.json();
  expect(result.data.requestId).toBe(response.request().postDataJSON().requestId);
  expect(response.headers()["x-request-id"]).toBe(result.data.requestId);
  expect(result.data.generation).toMatchObject({ requestId: result.data.requestId, provider: "mock", model: "fixture", promptVersion: "lesson-authoring-v1" });
  await expect(page.getByText(/AI tạo bản nháp · fixture/)).toBeVisible();
  return result.data.requestId as string;
}

test("admin generates, previews without writes, edits, revalidates and imports a complete new draft", async ({ page }) => {
  test.setTimeout(120000); const ctx = await setup(page); page.on("dialog", (dialog) => dialog.accept());
  try {
    const generationRequestId = await generate(page, ctx.lessonId, "10 nguyên âm cơ bản");
    expect(await prisma.lesson.count({ where: { chapterId: ctx.chapterId } })).toBe(1); expect(await prisma.lessonBlock.count({ where: { lessonId: ctx.lessonId } })).toBe(0);
    await expect(page.getByText("Schema: ✓ Hợp lệ", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Kiểm tra lại", exact: true }).click(); await expect(page.getByRole("button", { name: "Nhập vào bài học", exact: true })).toBeEnabled();
    await page.getByLabel("Cách nhập bản nháp", { exact: true }).selectOption("NEW");
    const title = "Bài AI đã kiểm tra"; await page.getByLabel("Tiêu đề bản nháp", { exact: true }).fill(title); await page.getByLabel("Slug bản nháp", { exact: true }).fill(`ai-import-${randomUUID()}`);
    await expect(page.getByRole("button", { name: "Nhập vào bài học", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Sửa khối 1", exact: true }).click(); const dialog = page.getByRole("dialog"); await dialog.getByLabel("Tiêu đề khối", { exact: true }).fill("Mở đầu đã sửa"); await dialog.getByRole("button", { name: "Áp dụng vào bản nháp", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Sửa từ 1", exact: true }).click(); await dialog.getByLabel("Nghĩa tiếng Việt", { exact: true }).fill("Em bé, đứa trẻ"); await dialog.getByRole("button", { name: "Áp dụng vào bản nháp", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Sửa câu 1", exact: true }).click(); await dialog.getByLabel("Đề bài câu hỏi", { exact: true }).fill("Chọn từ có nghĩa là dưa chuột."); await dialog.getByRole("button", { name: "Lưu câu hỏi", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Kiểm tra lại", exact: true }).click(); await expect(page.getByRole("button", { name: "Nhập vào bài học", exact: true })).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: ".temp/ai-preview-mobile.png", fullPage: true });
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: ".temp/ai-preview-mobile-viewport.png" });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: ".temp/ai-preview-desktop.png", fullPage: true });
    await page.getByRole("button", { name: "Nhập vào bài học", exact: true }).click(); await expect(page).toHaveURL(/\/admin\/lessons\/[^/]+\/edit$/); await page.reload();
    await expect(page.getByLabel("Tiêu đề bài học", { exact: true })).toHaveValue(title); await expect(page.getByLabel("Trạng thái xuất bản", { exact: true })).toHaveValue("DRAFT");
    const lessonId = new URL(page.url()).pathname.split("/")[3]; const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { blocks: true, vocabularies: { orderBy: { displayOrder: "asc" } }, exercises: { include: { questions: { orderBy: { displayOrder: "asc" }, include: { options: true } } } } } });
    expect(stored.learningObjectives).toHaveLength(4); expect(stored.blocks).toHaveLength(5); expect(stored.vocabularies).toHaveLength(5); expect(stored.exercises[0].questions).toHaveLength(4); expect(stored.exercises[0].questions[0].prompt).toBe("Chọn từ có nghĩa là dưa chuột."); expect(stored.exercises[0].questions[0].options).toHaveLength(3); expect(stored.exercises[0].status).toBe("DRAFT");
    expect(stored.blocks.find((b) => b.type === "VOCABULARY")?.content).toMatchObject({ vocabularyIds: stored.vocabularies.map((v) => v.id) }); expect(await prisma.aiLessonImport.count({ where: { lessonId } })).toBe(1);
    expect((await prisma.aiLessonImport.findFirstOrThrow({ where: { lessonId } })).generationMetadata).toMatchObject({ requestId: generationRequestId, provider: "mock", promptVersion: "lesson-authoring-v1" });
  } finally { await ctx.cleanup(); }
});

test("unknown vocabulary disables import and can be corrected in the reused question editor", async ({ page }) => {
  const ctx = await setup(page); page.on("dialog", (dialog) => dialog.accept());
  try {
    await generate(page, ctx.lessonId, "Từ chưa học"); await expect(page.getByRole("button", { name: "Nhập vào bài học", exact: true })).toBeDisabled(); await expect(page.getByTestId("ai-question-0-0").getByText(/사과.*chưa xuất hiện/)).toBeVisible();
    expect(await prisma.lessonBlock.count({ where: { lessonId: ctx.lessonId } })).toBe(0);
    await page.getByRole("button", { name: "Sửa câu 1", exact: true }).click(); const dialog = page.getByRole("dialog"); await dialog.getByLabel("Lựa chọn 1", { exact: true }).fill("오이"); await dialog.getByRole("button", { name: "Lưu câu hỏi", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Kiểm tra lại", exact: true }).click(); await expect(page.getByRole("button", { name: "Nhập vào bài học", exact: true })).toBeEnabled();
  } finally { await ctx.cleanup(); }
});

test("published lesson requires draft workflow; schema-invalid output never reaches preview", async ({ page }) => {
  const ctx = await setup(page);
  try {
    await prisma.lesson.update({ where: { id: ctx.lessonId }, data: { status: "PUBLISHED" } }); await generate(page, ctx.lessonId, "10 nguyên âm cơ bản"); await expect(page.getByRole("button", { name: "Nhập vào bài học", exact: true })).toBeDisabled();
    await expect(page.getByText(/Bài hiện tại chưa ở DRAFT/)).toBeVisible();
    const response = await page.request.post("/api/admin/ai-lessons/import", { data: { confirmed: true } }); expect(response.status()).toBe(400);
    page.on("dialog", (dialog) => dialog.accept()); await page.getByLabel("Chủ đề", { exact: true }).fill("invalid schema"); await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
    await expect(page.getByText("Schema: ✕ Không hợp lệ", { exact: true })).toBeVisible(); await expect(page.getByTestId("ai-draft-preview")).toHaveCount(0); expect(await prisma.lessonBlock.count({ where: { lessonId: ctx.lessonId } })).toBe(0);
  } finally { await ctx.cleanup(); }
});
