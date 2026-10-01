import { test, expect } from "./fixtures";

test("anonymous visitors can see syllabus but must sign in for lesson content", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Korean Zero/i);
  await page.goto("/courses");
  await expect(page.getByText(/Thời gian hoàn thành ước tính: 55 phút/)).toBeVisible();
  await page.goto("/courses/tieng-han-tu-con-so-0");
  await expect(page.locator("h1")).toContainText(/Tiếng Hàn từ con số 0/i);
  await expect(page.getByText("Giáo trình chi tiết")).toBeVisible();
  await page.goto("/courses/tieng-han-tu-con-so-0/lessons/bai-1-nguyen-am-co-ban");
  await expect(page).toHaveURL(/\/dang-nhap\?callbackUrl=/);
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/courses/tieng-han-tu-con-so-0/lessons/bai-1-nguyen-am-co-ban");
  await expect(page.getByText("Triết lý sáng tạo chữ Hangeul")).toHaveCount(0);
  await expect(page.locator("audio")).toHaveCount(0);
});
