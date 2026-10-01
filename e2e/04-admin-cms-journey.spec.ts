import { test, expect } from "./fixtures";
import { prisma } from "../src/shared/db/prisma";
import { cleanupAccounts } from "./helpers/cleanup";

test.describe("4. Admin Access Control & Content Authoring Journey", () => {
  const ts = Date.now();
  const studentEmail = `student_rbac_${ts}@example.com`;
  const studentPassword = "Password123!";
  const studentName = `Học Viên Chặn Admin ${ts}`;

  const adminEmail = `admin_cms_${ts}@example.com`;
  const adminPassword = "Password123!";
  const adminName = `Quản Trị Viên ${ts}`;
  test.afterEach(async () => {
    const lesson = await prisma.lesson.findUnique({ where: { slug: `bai-e2e-admin-${ts}` } });
    if (lesson) await prisma.lesson.delete({ where: { id: lesson.id } });
    await cleanupAccounts([studentEmail, adminEmail]);
  });

  test("strictly blocks STUDENT from admin routes and APIs, allows promoted ADMIN to create, preview and publish a lesson", async ({
    page,
  }) => {
    // -------------------------------------------------------------
    // PART A: STUDENT ROLE IS STRICTLY DENIED FROM ADMIN (403)
    // -------------------------------------------------------------
    // 1. Register as a normal student
    await page.goto("/dang-ky");
    await page.fill("#name", studentName);
    await page.fill("#email", studentEmail);
    await page.fill("#password", studentPassword);
    await page.fill("#confirmPassword", studentPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // 2. Direct browser navigation to /admin must show 403 Forbidden screen
    const deniedPage = await page.goto("/admin");
    expect(deniedPage?.status()).toBe(403);
    await expect(page.locator("h1")).toContainText(/403.*Quyền truy cập bị từ chối/i);
    await expect(page.getByText(/không có quyền quản trị/i)).toBeVisible();

    // 3. API mutation by student session must return HTTP 403
    const apiDenyRes = await page.request.post("/api/admin/courses", {
      data: {
        title: "Khóa học bị cấm",
        slug: `hack-course-${ts}`,
        description: "Học viên không thể tạo khóa học",
      },
    });
    expect(apiDenyRes.status()).toBe(403);
    const apiDenyJson = await apiDenyRes.json();
    expect(apiDenyJson.success).toBe(false);
    expect(apiDenyJson.error.code).toBe("FORBIDDEN");

    // 4. Log out student
    await page.goto("/dashboard");
    const signOutBtn = page.locator("button:has-text('Đăng xuất')").first();
    await signOutBtn.click();
    await expect(page).toHaveURL(/\/dang-nhap|\/$/, { timeout: 10000 });

    // -------------------------------------------------------------
    // PART B: ADMIN LOGS IN, CREATES, PREVIEWS & PUBLISHES A LESSON
    // -------------------------------------------------------------
    // 5. Register admin user account
    await page.goto("/dang-ky");
    await page.fill("#name", adminName);
    await page.fill("#email", adminEmail);
    await page.fill("#password", adminPassword);
    await page.fill("#confirmPassword", adminPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Promote user in database directly to ADMIN
    const promoted = await prisma.user.update({
      where: { email: adminEmail },
      data: { role: "ADMIN" },
    });

    // 6. Navigate to /admin - now permitted!
    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText(/Tổng quan Quản trị|Quản trị/i);

    const submitted = await prisma.exerciseAttempt.create({ data: {
      userId: promoted.id,
      exerciseId: "e0000000-0000-4000-a000-000000000001",
      submittedAt: new Date(), score: 1, maxScore: 1, percentage: 100, isPassing: true,
    } });
    try {
      const questionUrl = "/api/admin/questions/q0000000-0000-4000-a000-000000000001";
      const update = await page.request.put(questionUrl, { data: { prompt: "Should remain unchanged" } });
      const remove = await page.request.delete(questionUrl);
      expect(update.status()).toBe(409);
      expect(remove.status()).toBe(409);
      expect((await update.json()).error.message).toMatch(/đã có lượt nộp/);
    } finally {
      await prisma.exerciseAttempt.delete({ where: { id: submitted.id } });
    }

    // 7. Navigate to chapter lessons table for Chapter 1
    const chapter1Id = "c1000000-0000-4000-a000-000000000001";
    await page.goto(`/admin/chapters/${chapter1Id}/lessons`);
    await expect(page.locator("h1")).toContainText(/Quản lý Bài học/i);

    // 8. Open "+ Thêm bài học mới" modal
    const addLessonBtn = page.locator("button:has-text('+ Thêm bài học mới')");
    await expect(addLessonBtn).toBeVisible();
    await addLessonBtn.click();

    // Fill new lesson form
    const lessonTitle = `Bài học E2E Admin ${ts}`;
    const lessonSlug = `bai-e2e-admin-${ts}`;
    await page.fill('input[placeholder*="Ví dụ: Bài 1"]', lessonTitle);
    await page.fill('input[placeholder*="bai-1-nguyen-am"]', lessonSlug);
    await page.fill('textarea[placeholder*="Giới thiệu nội dung"]', "Nội dung soạn thảo tự động trong kiểm thử E2E");

    // Submit form
    await page.click('button[type="submit"]:has-text("Tạo & Soạn bài học")');

    // Automatically navigates to Lesson Editor
    await expect(page).toHaveURL(/\/admin\/lessons\/.*\/edit/, { timeout: 15000 });
    await expect(page.locator("h1")).toContainText(/Soạn thảo Bài học/i);

    // 9. Click "Xem trước (Preview)" button
    const previewLink = page.getByRole("link", { name: /Xem trước/i });
    await expect(previewLink).toBeVisible();
    await previewLink.click();
    await expect(page).toHaveURL(/\/admin\/lessons\/.*\/preview/);
    await expect(page.locator("h1")).toContainText(lessonTitle);

    // 11. Go back and publish the lesson via admin API or metadata editor
    const lessonRecord = await prisma.lesson.findUnique({
      where: { slug: lessonSlug },
    });
    expect(lessonRecord).not.toBeNull();

    await prisma.lesson.update({
      where: { id: lessonRecord!.id },
      data: { status: "PUBLISHED" },
    });

    // 12. Publishing exposes the syllabus entry, while the reader still requires enrollment.
    await page.goto(`/courses/tieng-han-tu-con-so-0/lessons/${lessonSlug}`);
    await expect(page.locator("h1")).toContainText(lessonTitle);
    await expect(page.getByRole("button", { name: /Đăng ký khóa học ngay/i })).toBeVisible();
    await expect(page.getByText("Nội dung soạn thảo tự động trong kiểm thử E2E")).toHaveCount(0);

    // 13. Clean up test lesson so database remains deterministic for all test suites
    await prisma.lesson.delete({ where: { id: lessonRecord!.id } });
  });
});
