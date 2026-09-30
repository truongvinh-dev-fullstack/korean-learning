import { test, expect } from "@playwright/test";

test.describe("1. Anonymous Visitor Course Browsing Journey", () => {
  test("allows an unauthenticated visitor to explore landing page, courses catalog, syllabus and lesson content", async ({
    page,
  }) => {
    // 1. Visit landing page
    await page.goto("/");
    await expect(page).toHaveTitle(/Korean Zero/i);
    await expect(page.locator("h1")).toContainText("Chinh phục tiếng Hàn");
    await expect(page.getByText("Học tiếng Hàn bài bản • Miễn phí 100%")).toBeVisible();

    // 2. Navigate to Course Catalog via top navbar
    const catalogLink = page.getByRole("link", { name: "Khóa học", exact: true });
    await catalogLink.click();
    await expect(page).toHaveURL(/\/courses/);
    await expect(page.locator("h1")).toContainText(/Danh mục khóa học/i);

    // 3. Find and inspect the beginner course card
    const beginnerCourseCard = page
      .locator("div")
      .filter({ hasText: "Tiếng Hàn Từ Con Số 0" })
      .first();
    await expect(beginnerCourseCard).toBeVisible();
    await expect(beginnerCourseCard.getByText(/Căn bản|BEGINNER/i)).toBeVisible();

    // 4. Click into the course syllabus page
    await page.getByRole("link", { name: /Tiếng Hàn từ con số 0/i }).first().click();
    await expect(page).toHaveURL(/\/courses\/tieng-han-tu-con-so-0/);
    await expect(page.locator("h1")).toContainText(/Tiếng Hàn từ con số 0/i);

    // 5. Verify syllabus chapters and lesson list
    await expect(page.getByText("Giáo trình chi tiết")).toBeVisible();
    await expect(page.getByText(/Bài 1: 10 Nguyên âm cơ bản/i)).toBeVisible();

    // 6. Navigate directly into Lesson 1 as anonymous visitor
    await page.click("a:has-text('Bài 1: 10 Nguyên âm cơ bản')");
    await expect(page).toHaveURL(/\/courses\/tieng-han-tu-con-so-0\/lessons\/bai-1-nguyen-am-co-ban/);

    // 7. Verify lesson content renders properly for visitors
    await expect(page.locator("h1")).toContainText(/Bài 1: 10 Nguyên âm cơ bản/i);
    await expect(page.getByText("Triết lý sáng tạo chữ Hangeul")).toBeVisible();

    // Verify audio player block is rendered
    const audioElement = page.locator("audio");
    await expect(audioElement.first()).toBeVisible();

    // 8. Verify that marking completion prompts login
    const completeButton = page.locator("button:has-text('Đánh dấu hoàn thành bài học')");
    if (await completeButton.isVisible()) {
      await completeButton.click();
      // Should redirect to login with callbackUrl
      await expect(page).toHaveURL(/\/dang-nhap/);
    }
  });
});
