import { test, expect } from "./fixtures";
import { passFirstSeedExercise } from "./helpers/learning";
import { cleanupAccounts } from "./helpers/cleanup";

test.describe("3. Student Enrollment, Lesson Progress & Dashboard Sync Journey", () => {
  const ts = Date.now();
  const testEmail = `enroll_progress_${ts}@example.com`;
  const testPassword = "Password123!";
  const testName = `Học Viên Tiến Độ ${ts}`;
  test.afterEach(async () => { await cleanupAccounts([testEmail]); });

  test("enrolls student in course, completes lesson 1, and verifies dashboard metrics & continue-learning state", async ({
    page,
  }) => {
    // 1. Sign up new student
    await page.goto("/dang-ky");
    await page.fill("#name", testName);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Bảng học tập cá nhân");

    // 2. Navigate to Course page
    await page.goto("/courses/tieng-han-tu-con-so-0");
    await expect(page.locator("h1")).toContainText(/Tiếng Hàn từ con số 0/i);

    // 3. Click Enroll Button
    const enrollBtn = page.getByRole("button", {
      name: /Đăng ký khóa học ngay/i,
    });
    await expect(enrollBtn).toBeVisible();
    await enrollBtn.click();

    // 4. Enrollment redirects automatically to the first lesson
    await expect(page).toHaveURL(
      /\/courses\/tieng-han-tu-con-so-0\/lessons\/bai-1-nguyen-am-co-ban/,
      { timeout: 15000 }
    );
    await expect(page.locator("h1")).toContainText(/Bài 1: 10 Nguyên âm cơ bản/i);
    const startResponse = await page.request.post("/api/lessons/l0000000-0000-4000-a000-000000000001/progress", { data: { action: "START" } });
    expect(startResponse.status()).toBe(200);

    // 5. A passing server-graded attempt completes Lesson 1.
    await passFirstSeedExercise(page);
    await page.reload();

    // Verify status changed to Completed
    await expect(page.getByText("Đã hoàn thành", { exact: true })).toBeVisible({ timeout: 10000 });

    // 6. Navigate to Dashboard to verify synced metrics
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Bảng học tập cá nhân");

    // Verify streak metric is recorded
    await expect(page.getByText("Chuỗi học tập")).toBeVisible();
    await expect(page.getByText(/Đã học hôm nay/i)).toBeVisible();

    // Verify Continue Learning card is visible and points to Lesson 2
    const continueCard = page.locator("section[aria-label*='Tiếp tục']").or(
      page.locator("div", { hasText: "Tiếp tục học" })
    );
    await expect(continueCard.first()).toBeVisible();
    await expect(page.getByText(/Bài 2: 10 Phụ âm cơ bản/i)).toBeVisible();
  });
});
