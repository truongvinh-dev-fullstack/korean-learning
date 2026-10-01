import { test, expect } from "./fixtures";
import { enrollInSeedCourse, passFirstSeedExercise } from "./helpers/learning";
import { cleanupAccounts } from "./helpers/cleanup";

test.describe("SRS Spaced Repetition Flashcard Review Flow", () => {
  const timestamp = Date.now();
  const testEmail = `srs_playwright_${timestamp}@example.com`;
  const testPassword = "Password123!";
  const testName = "Học Viên SRS";
  test.afterEach(async () => { await cleanupAccounts([testEmail]); });

  test("completes end-to-end flashcard review journey with keyboard shortcuts and empty states", async ({
    page,
  }) => {
    // 1. Sign up a new student
    await page.goto("/dang-ky");
    await page.fill("#name", testName);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await enrollInSeedCourse(page);

    // 2. Check /on-tap initial empty state when no cards have been enqueued yet
    await page.goto("/on-tap");
    await expect(page.locator("h2")).toContainText("Không có thẻ nào cần ôn tập hôm nay!");
    await expect(page.getByText("Học bài mới →")).toBeVisible();

    // 3. Complete Lesson 1 to automatically enqueue its vocabulary into the SRS deck
    const lessonUrl = "/courses/tieng-han-tu-con-so-0/lessons/bai-1-nguyen-am-co-ban";
    await page.goto(lessonUrl);
    await expect(page.locator("h1")).toContainText("Bài 1: 10 Nguyên âm cơ bản");

    await passFirstSeedExercise(page);
    await page.reload();
    await expect(page.getByText("Đã hoàn thành", { exact: true })).toBeVisible({ timeout: 10000 });

    // 4. Return to /dashboard and verify SRS due count is updated
    await page.goto("/dashboard");
    const srsMetricCard = page.getByRole("link", { name: /Ôn tập hôm nay/ });
    await expect(srsMetricCard).toBeVisible();
    await expect(srsMetricCard).toContainText("thẻ");
    await expect(srsMetricCard).toContainText("Ôn ngay →");

    // Click "Ôn ngay →" into /on-tap
    await srsMetricCard.click();
    await expect(page).toHaveURL(/\/on-tap/);

    // 5. Active Flashcard Runner should now display due cards
    await expect(page.getByText("Thẻ 1 /")).toBeVisible();
    await expect(page.getByText("👆 Nhấp vào thẻ hoặc nhấn [Phím Cách] để xem nghĩa")).toBeVisible();

    // Test romanization toggle hint
    await page.click("button:has-text('Xem phiên âm')");
    await expect(page.locator("span.font-mono")).toBeVisible();

    // 6. Test card flip interaction via Space key
    await page.keyboard.press("Space");
    await expect(page.getByText("Nghĩa tiếng Việt:")).toBeVisible();
    await expect(page.getByText("Bạn nhớ từ này như thế nào?")).toBeVisible();

    // 7. Test rating via keyboard shortcut '3' (GOOD)
    await page.keyboard.press("3");

    // Verify it advanced to Card 2
    await expect(page.getByText("Thẻ 2 /")).toBeVisible({ timeout: 5000 });

    // 8. Test card flip interaction via click and rating via button '4' (EASY)
    const flashcard = page.locator("div[role='region']");
    await flashcard.click();
    await expect(page.getByText("Nghĩa tiếng Việt:")).toBeVisible();

    // Click rating button "Dễ"
    const easyBtn = page.locator("button:has-text('Dễ')");
    await easyBtn.click();

    // Continue reviewing remaining cards until session completion
    while (await page.locator("div[role='region']").isVisible()) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(300);
      await page.keyboard.press("3"); // Good
      await page.waitForTimeout(500);
    }

    // 9. Verify Session Completion Screen
    await expect(page.locator("h2")).toContainText("Xuất sắc! Bạn đã ôn tập xong");
    await expect(
      page.getByText("Tiến độ ôn tập hôm nay đã được ghi nhận vào chuỗi Streak của bạn!")
    ).toBeVisible();

    // 10. Click "Về Bảng học tập cá nhân →"
    await page.click("a:has-text('Về Bảng học tập cá nhân →')");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
