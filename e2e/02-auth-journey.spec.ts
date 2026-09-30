import { test, expect } from "@playwright/test";

test.describe("2. Authentication Journey (Register, Logout, Error Handling, Login)", () => {
  const ts = Date.now();
  const testEmail = `auth_student_${ts}@example.com`;
  const testPassword = "Password123!";
  const testName = `Học Viên Test ${ts}`;

  test("validates registration form, registers user, logs out, handles bad login, and logs back in", async ({
    page,
  }) => {
    // 1. Visit Register Page
    await page.goto("/dang-ky");
    await expect(page.locator("h1")).toContainText("Tạo tài khoản học viên");

    // 2. Client-side validation: Password mismatch
    await page.fill("#name", testName);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirmPassword", "DifferentPassword456!");
    await page.click('button[type="submit"]');

    // Should display validation error
    await expect(page.getByText(/không trùng khớp/i)).toBeVisible();

    // 3. Fix confirmation password and successfully register
    await page.fill("#confirmPassword", testPassword);
    await page.click('button[type="submit"]');

    // 4. Expect auto-redirect to dashboard upon successful registration
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Bảng học tập cá nhân");
    await expect(page.getByText(testName).first()).toBeVisible();

    // 5. Log out
    const signOutBtn = page.locator("button:has-text('Đăng xuất')").first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Wait for redirect to login page or home
    await expect(page).toHaveURL(/\/dang-nhap|\/$/, { timeout: 10000 });

    // 6. Attempt login with WRONG password
    await page.goto("/dang-nhap");
    await page.fill("#email", testEmail);
    await page.fill("#password", "WrongPassword999!");
    await page.click('button[type="submit"]');

    // Expect actionable error message
    await expect(page.locator("div[role='alert']").or(page.getByText(/không chính xác|không hợp lệ/i))).toBeVisible();

    // 7. Login with CORRECT credentials
    await page.fill("#password", testPassword);
    await page.click('button[type="submit"]');

    // Expect redirect back to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Bảng học tập cá nhân");
    await expect(page.getByText(testName).first()).toBeVisible();
  });
});
