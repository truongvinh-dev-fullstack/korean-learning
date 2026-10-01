import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { prisma } from "../src/shared/db/prisma";
import { enrollInSeedCourse, passFirstSeedExercise } from "./helpers/learning";

async function register(page: Page, prefix: string) {
  const email = `${prefix}-${randomUUID()}@example.com`;
  await page.goto("/dang-ky");
  await page.fill("#name", "Release learner"); await page.fill("#email", email);
  await page.fill("#password", "Password123!"); await page.fill("#confirmPassword", "Password123!");
  await page.getByRole("button", { name: "Đăng ký tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function reloadSettled(page: Page) {
  // Saving also schedules router.refresh(). Let that response finish before reload
  // so verification does not cancel the server's in-flight React stream.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await page.waitForLoadState("networkidle");
}

test("F1/F3/F6: admin edits blocks and arrangement tiles; student plays audio and recovers a saved quiz", async ({ page }) => {
  test.setTimeout(120_000);
  const users: string[] = [];
  const courseId = randomUUID(), courseSlug = `rc-${courseId}`, lessonSlug = `rc-${randomUUID()}`;
  let created = false;
  try {
    const admin = await register(page, "rc-admin"); users.push(admin.id);
    await prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
    const course = await prisma.course.create({ data: {
      id: courseId, slug: courseSlug, title: "RC course", description: "RC", status: "PUBLISHED",
      chapters: { create: { slug: `rc-${randomUUID()}`, title: "RC chapter", status: "PUBLISHED", lessons: { create: { slug: lessonSlug, title: "RC lesson", status: "PUBLISHED" } } } },
    }, include: { chapters: { include: { lessons: true } } } }); created = true;
    const lessonId = course.chapters[0].lessons[0].id;
    const blockResponse = await page.request.post(`/api/admin/lessons/${lessonId}/blocks`, { data: { type: "TEXT", content: { markdown: "Original existing block" } } });
    expect(blockResponse.status()).toBe(201);
    const blockId = (await blockResponse.json()).data.id;
    await page.goto(`/admin/lessons/${lessonId}/edit`);
    await page.getByRole("button", { name: "Sửa", exact: true }).click();
    await page.getByRole("dialog").locator("textarea").fill(JSON.stringify({ markdown: "Persisted browser edit" }));
    await page.getByRole("button", { name: "Cập nhật khối", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await reloadSettled(page);
    await expect(page.getByText(/Persisted browser edit/)).toBeVisible();
    const reload = await page.request.get(`/api/admin/lessons/${lessonId}/blocks`);
    expect((await reload.json()).data.find((block: { id: string }) => block.id === blockId).content.markdown).toBe("Persisted browser edit");
    const invalid = await page.request.put(`/api/admin/blocks/${blockId}`, { data: { type: "AUDIO", content: {} } });
    expect(invalid.status()).toBe(400);

    const dialogue = await page.request.post(`/api/admin/lessons/${lessonId}/blocks`, { data: {
      type: "DIALOGUE", content: { title: "RC dialogue", audioUrl: "/audio/lessons/korean-vowels.ogg", lines: [
        { speaker: "Minho", korean: "물", vietnamese: "Nước", audioUrl: "/audio/vocab/mul.ogg" },
        { speaker: "Lan", korean: "네", vietnamese: "Vâng" },
      ] },
    } }); expect(dialogue.status()).toBe(201);
    const exerciseResponse = await page.request.post(`/api/admin/lessons/${lessonId}/exercises`, { data: { title: "RC arrangement", status: "PUBLISHED" } });
    expect(exerciseResponse.status()).toBe(201);
    const exerciseId = (await exerciseResponse.json()).data.id;
    await reloadSettled(page);
    await page.getByRole("button", { name: "+ Thêm câu hỏi", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Loại câu hỏi", { exact: true }).selectOption("ARRANGE_SENTENCE");
    await dialog.getByPlaceholder("Ví dụ: Chọn nguyên âm phát âm là 'a' trong tiếng Hàn").fill("Ghép câu có từ lặp lại");
    // Exercise the tile CRUD/reorder controls, retaining duplicate word instances.
    while (await dialog.getByTestId("arrangement-tile").count()) await dialog.getByRole("button", { name: "Xóa thẻ 1", exact: true }).click();
    for (const text of ["가", "가", "나", "discard"]) {
      await dialog.getByRole("button", { name: "Thêm thẻ từ", exact: true }).click();
      await dialog.getByTestId("arrangement-tile").last().locator("input").fill(text);
    }
    await dialog.getByRole("button", { name: "Xóa thẻ 4", exact: true }).click();
    await dialog.getByRole("button", { name: "Đưa lên thẻ 3", exact: true }).click();
    await dialog.getByLabel("Đáp án chuẩn", { exact: true }).fill("가 가 나");
    await dialog.getByRole("button", { name: "Lưu câu hỏi", exact: true }).click();
    await expect(dialog).toHaveCount(0); await reloadSettled(page);
    // Editing an existing question must show and preserve its bank.
    await page.locator("div.p-3\\.5").filter({ hasText: "Ghép câu có từ lặp lại" }).getByRole("button", { name: "Sửa", exact: true }).click();
    await expect(dialog.getByLabel("Thẻ từ 1", { exact: true })).toHaveValue("가");
    await expect(dialog.getByLabel("Thẻ từ 2", { exact: true })).toHaveValue("나");
    await dialog.getByLabel("Thẻ từ 2", { exact: true }).fill("나");
    await dialog.getByRole("button", { name: "Lưu câu hỏi", exact: true }).click();
    await expect(dialog).toHaveCount(0); await reloadSettled(page);
    const question = await prisma.question.findFirstOrThrow({ where: { exerciseId }, include: { options: { orderBy: { displayOrder: "asc" } } } });
    expect(question.options.map((o) => o.text)).toEqual(["가", "나", "가"]);

    await page.goto("/dashboard"); await page.getByRole("button", { name: /Đăng xuất/ }).first().click();
    await expect(page).toHaveURL(/dang-nhap|\/$/);
    const student = await register(page, "rc-student"); users.push(student.id);
    expect((await page.request.post(`/api/courses/${courseId}/enroll`)).status()).toBe(200);
    await page.goto(`/courses/${courseSlug}/lessons/${lessonSlug}`);
    await expect(page.getByText("Persisted browser edit", { exact: true })).toBeVisible();
    const players = page.locator("audio"); await expect(players).toHaveCount(2);
    for (const player of await players.all()) {
      expect(await player.getAttribute("aria-label")).toBeTruthy();
      expect(await player.evaluate(async (audio) => {
        const element = audio as HTMLAudioElement;
        await element.play(); const playing = !element.paused; element.pause(); return playing && element.duration > 0;
      })).toBe(true);
    }
    await page.getByRole("button", { name: "가", exact: true }).nth(0).click();
    await page.getByRole("button", { name: "가", exact: true }).nth(1).click();
    await page.getByRole("button", { name: "나", exact: true }).click();
    const bodies: object[] = [], results: object[] = [];
    await page.route(`**/api/exercises/${exerciseId}/submit`, async (route) => {
      bodies.push(route.request().postDataJSON());
      const response = await route.fetch(); expect(response.status()).toBe(200);
      results.push(await response.json());
      // Server committed; the first response body never reaches the client.
      await route.fulfill({ response, ...(results.length === 1 ? { body: "" } : {}) });
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole("button", { name: "Nộp bài tập", exact: true }).click();
      await page.getByRole("button", { name: "Nộp bài ngay", exact: true }).click();
      if (attempt === 0) await expect(page.getByText(/JSON|Unexpected|nộp bài\./).last()).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "100%", exact: true })).toBeVisible();
    expect(results[1]).toEqual(results[0]); expect(bodies[1]).toEqual(bodies[0]);
    expect(await prisma.exerciseAttempt.count({ where: { userId: student.id, exerciseId } })).toBe(1);
    expect((await prisma.dailyStudyStat.findFirstOrThrow({ where: { userId: student.id } })).lessonsCompleted).toBe(1);
    await page.goto("/dashboard");
    const metric = page.getByText("Từ vựng đã nạp", { exact: true }).locator("../..");
    await expect(metric).toContainText("0");
    expect(await prisma.reviewCard.count({ where: { userId: student.id } })).toBe(0);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (created) await prisma.course.delete({ where: { id: courseId } });
  }
});

test("F4/F5: saved SRS review recovers, focused buttons and links retain keyboard behavior", async ({ page }) => {
  let userId: string | undefined;
  try {
    const user = await register(page, "rc-srs"); userId = user.id;
    await enrollInSeedCourse(page); await passFirstSeedExercise(page);
    await page.goto("/on-tap");
    const bodies: { idempotencyKey: string; cardId: string }[] = [], results: object[] = [];
    await page.route("**/api/srs/review", async (route) => {
      bodies.push(route.request().postDataJSON());
      const response = await route.fetch(); expect(response.status()).toBe(200); results.push(await response.json());
      await route.fulfill({ response, ...(results.length === 1 ? { body: "" } : {}) });
    });
    // Native React clicks are replayed during hydration; window shortcuts are not.
    await page.getByRole("button", { name: /Lật thẻ/ }).click();
    const good = page.getByRole("button", { name: /Tốt/ });
    await expect(good).toBeVisible();
    await good.focus(); await page.keyboard.press("Enter");
    await expect(page.getByText(/JSON|Unexpected|kết nối/).last()).toBeVisible();
    await good.focus(); await page.keyboard.press("Space");
    await expect(page.getByText("Thẻ 2 /")).toBeVisible();
    expect(bodies[1]).toEqual(bodies[0]); expect(results[1]).toEqual(results[0]);
    expect(await prisma.reviewLog.count({ where: { idempotencyKey: bodies[0].idempotencyKey } })).toBe(1);
    await page.locator("body").click({ position: { x: 1, y: 1 } }); await page.keyboard.press("Space");
    await good.focus(); await page.keyboard.press("Space");
    await expect(page.getByText("Thẻ 3 /")).toBeVisible();
    await page.locator("body").click({ position: { x: 1, y: 1 } }); await page.keyboard.press("Enter"); await page.keyboard.press("3");
    await expect(page.getByText("Thẻ 4 /")).toBeVisible();
    const dashboardLink = page.locator('a[href="/dashboard"]').first();
    await dashboardLink.focus(); await page.keyboard.press("Enter"); await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/on-tap");
    await expect(page.getByText("Thẻ 1 /")).toBeVisible();
  } finally { if (userId) await prisma.user.delete({ where: { id: userId } }); }
});
