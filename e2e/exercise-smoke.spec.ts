import { test, expect } from "./fixtures";
import { enrollInSeedCourse, passFirstSeedExercise } from "./helpers/learning";
import { cleanupAccounts } from "./helpers/cleanup";

test.describe("Student Exercise Flow & Security Verification", () => {
  const createdEmails: string[] = [];
  test.afterEach(async () => { await cleanupAccounts(createdEmails.splice(0)); });
  test("completes interactive exercise with cheat protection and full feedback loop", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const testEmail = `playwright_student_1_${timestamp}@example.com`;
    createdEmails.push(testEmail);
    const testPassword = "Password123!";
    const testName = "Học Viên Playwright 1";

    // 1. Sign up a new student through the UI
    await page.goto("/dang-ky");
    await expect(page.locator("h1")).toContainText("Tạo tài khoản học viên");

    await page.fill("#name", testName);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await enrollInSeedCourse(page);

    // 2. Navigate to Lesson 1 which contains Exercise 1
    const lessonUrl = "/courses/tieng-han-tu-con-so-0/lessons/bai-1-nguyen-am-co-ban";
    await page.goto(lessonUrl);

    // Verify page rendered
    await expect(page.locator("h1")).toContainText("Bài 1: 10 Nguyên âm cơ bản");

    // 3. Security Audit: verify that pre-submit payload does NOT contain answer keys
    // Verify by fetching the sanitized exercise API directly in the student browser session
    const apiResponse = await page.request.get(
      "/api/exercises/e0000000-0000-4000-a000-000000000001"
    );
    expect(apiResponse.ok()).toBeTruthy();
    const payload = await apiResponse.json();
    expect(payload.success).toBe(true);

    const questions = payload.data.questions;
    expect(questions.length).toBe(4);

    for (const q of questions) {
      // Must NOT leak correctAnswer or private solution explanation
      expect(q.correctAnswer).toBeUndefined();
      expect(q.explanation).toBeUndefined();

      for (const opt of q.options) {
        // Must NOT leak isCorrect or option-level solution explanation
        expect(opt.isCorrect).toBeUndefined();
        expect(opt.explanation).toBeUndefined();
      }
    }

    // 4. Scroll to Exercise Runner section
    const exerciseSection = page.locator("section:has-text('Bài tập củng cố kiến thức')");
    await expect(exerciseSection).toBeVisible();

    // Verify progress indicator is showing Question 1
    await expect(page.getByText("Đã làm: 0 / 4 câu")).toBeVisible();
    await expect(page.getByText("Câu hỏi 1 / 4")).toBeVisible();

    // 5. Answer Question 1 (MULTIPLE_CHOICE: "Từ nào sau đây có nghĩa là 'Quả dưa chuột'?")
    // Click option "오i"
    const optCucumber = page.locator("button:has-text('오이')").first();
    await optCucumber.click();
    await expect(page.getByText("Đã làm: 1 / 4 câu")).toBeVisible();

    // Advance to Question 2
    await page.click("button:has-text('Câu tiếp →')");
    await expect(page.getByText("Câu hỏi 2 / 4")).toBeVisible();

    // 6. Answer Question 2 (MULTIPLE_CHOICE: "Nguyên âm nào dưới đây có cách phát âm là [o] (chúm tròn môi)?")
    const optO = page.locator("button:has-text('ㅗ')").first();
    await optO.click();
    await expect(page.getByText("Đã làm: 2 / 4 câu")).toBeVisible();

    // Advance to Question 3
    await page.click("button:has-text('Câu tiếp →')");
    await expect(page.getByText("Câu hỏi 3 / 4")).toBeVisible();

    // 7. Answer Question 3 (FILL_BLANK: "Điền chữ cái còn thiếu: 'Sữa tươi' trong tiếng Hàn là 우___ (uyu).")
    const blankInput = page.locator('input[placeholder*="Nhập chữ cái"]');
    await blankInput.fill("유");
    await expect(page.getByText("Đã làm: 3 / 4 câu")).toBeVisible();

    // Advance to Question 4
    await page.click("button:has-text('Câu tiếp →')");
    await expect(page.getByText("Câu hỏi 4 / 4")).toBeVisible();

    // 8. Answer Question 4 (LISTENING_CHOICE with audio: "Nghe đoạn âm thanh và chọn nguyên âm bạn nghe được:")
    const audioElement = exerciseSection.locator("audio");
    await expect(audioElement).toBeVisible();

    // Select correct listening option 'ㅏ'
    const audioOptA = page.locator("button:has-text('ㅏ')").first();
    await audioOptA.click();
    await expect(page.getByText("Đã làm: 4 / 4 câu")).toBeVisible();

    // 9. Click "Nộp bài tập" to trigger Submit Confirmation Modal
    await page.click("button:has-text('Nộp bài tập')");

    // Modal verification
    const modalHeading = page.locator("h4:has-text('Xác nhận nộp bài')");
    await expect(modalHeading).toBeVisible();
    await expect(page.getByText("Bạn đã trả lời 4 trên tổng số 4 câu hỏi.")).toBeVisible();

    // Click "Nộp bài ngay" inside modal
    await page.click("button:has-text('Nộp bài ngay')");

    // 10. Result Summary Card Verification
    // Expect score percentage (100% since all 4 were correct)
    await expect(page.getByText("100%")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("🎉 ĐẠT YÊU CẦU (≥ 80%)")).toBeVisible();

    // 11. Explanation breakdown after submission
    await expect(
      page.getByText("Chi tiết lời giải & giải thích đáp án")
    ).toBeVisible();
    await expect(page.getByText("✔ Chính xác (+10 điểm)").first()).toBeVisible();

    // 12. Retry action verification
    const retryBtn = page.locator("button:has-text('🔄 Làm lại bài tập')");
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // Verify it reset to Question 1 with 0 answered
    await expect(page.getByText("Đã làm: 0 / 4 câu")).toBeVisible();
    await expect(page.getByText("Câu hỏi 1 / 4")).toBeVisible();
  });

  test("handles arrange sentence word tiles with add, remove and authenticated submission", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const testEmail = `playwright_student_2_${timestamp}@example.com`;
    createdEmails.push(testEmail);
    const testPassword = "Password123!";
    const testName = "Học Viên Playwright 2";

    // 1. Sign up student
    await page.goto("/dang-ky");
    await page.fill("#name", testName);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await enrollInSeedCourse(page);
    await passFirstSeedExercise(page);

    // 2. Navigate to Lesson 2
    const lesson2Url = "/courses/tieng-han-tu-con-so-0/lessons/bai-2-phu-am-co-ban";
    await page.goto(lesson2Url);
    await expect(page.locator("h1")).toContainText("Bài 2: 10 Phụ âm cơ bản");

    // 3. Scroll to Exercise Runner
    const exerciseSection = page.locator("section:has-text('Bài tập củng cố kiến thức')");
    await expect(exerciseSection).toBeVisible();

    // Answer Q1 (Multiple choice: Cái cây)
    await page.locator("button:has-text('Cái cây')").click();
    await page.click("button:has-text('Câu tiếp →')");

    // Answer Q2 (Fill blank: 자)
    const blankInput = page.locator('input[placeholder*="Nhập chữ cái"]');
    await blankInput.fill("자");
    await page.click("button:has-text('Câu tiếp →')");

    // Q3: Arrange Sentence
    await expect(page.getByText("Sắp xếp các khối từ sau")).toBeVisible();

    // Click word tiles in order: 저는, 우유를, 마셔요
    const tileJeo = page.locator("button:text-is('저는')");
    const tileUyu = page.locator("button:text-is('우유를')");
    const tileMasyeo = page.locator("button:text-is('마셔요')");

    await tileJeo.click();
    await tileUyu.click();
    await tileMasyeo.click();

    // Verify assembled sentence shows all 3 tiles
    await expect(page.locator("button:has-text('저는 ×')")).toBeVisible();
    await expect(page.locator("button:has-text('우유를 ×')")).toBeVisible();
    await expect(page.locator("button:has-text('마셔요 ×')")).toBeVisible();

    // Test removing a tile (undo) by clicking it
    await page.locator("button:has-text('마셔요 ×')").click();
    // Verify masyeo is back in the tile bank and unselected
    await expect(tileMasyeo).toBeEnabled();

    // Click it again to complete sentence
    await tileMasyeo.click();

    // Submit
    await page.click("button:has-text('Nộp bài tập')");
    await expect(page.locator("h4:has-text('Xác nhận nộp bài')")).toBeVisible();
    await page.click("button:has-text('Nộp bài ngay')");

    // Verify result card
    await expect(page.getByText("100%")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("🎉 ĐẠT YÊU CẦU (≥ 80%)")).toBeVisible();
  });
});
