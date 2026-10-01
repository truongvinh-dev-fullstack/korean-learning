import { test, expect } from "./fixtures";
import { enrollInSeedCourse } from "./helpers/learning";
import { cleanupAccounts } from "./helpers/cleanup";
import { prisma } from "../src/shared/db/prisma";

const email = `vocabulary_audio_${Date.now()}@example.com`;
test.afterEach(async () => { await cleanupAccounts([email]); });

test("plays the exact vocabulary recording in lesson cards, summary and admin preview", async ({ page }) => {
  await page.goto("/dang-ky");
  await page.fill("#name", "Học viên nghe từ vựng");
  await page.fill("#email", email);
  await page.fill("#password", "Password123!");
  await page.fill("#confirmPassword", "Password123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
  await enrollInSeedCourse(page);

  const audioRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/audio/vocab/")) audioRequests.push(request.url());
  });
  await page.goto("/courses/tieng-han-tu-con-so-0/lessons/bai-1-nguyen-am-co-ban");
  const cardButton = page.getByRole("button", { name: "Nghe phát âm 아이", exact: true }).first();
  const summaryButton = page.getByRole("table").getByRole("button", { name: "Nghe phát âm 아이", exact: true });
  await expect(cardButton).toBeEnabled();
  await expect(summaryButton).toBeEnabled();
  expect(audioRequests).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Nghe phát âm 오이", exact: true }).first()).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await cardButton.scrollIntoViewIfNeeded();
  const bounds = await cardButton.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".temp/vocabulary-mobile.png" });

  // Capture real HTMLAudioElement instances while preserving browser media playback.
  await page.evaluate(() => {
    const OriginalAudio = window.Audio;
    const audios: HTMLAudioElement[] = [];
    Object.assign(window, { vocabularyTestAudios: audios });
    window.Audio = class extends OriginalAudio {
      constructor() { super(); audios.push(this); }
    };
  });
  await cardButton.click();
  await expect.poll(() => page.evaluate(() => {
    const audios = (window as unknown as { vocabularyTestAudios: HTMLAudioElement[] }).vocabularyTestAudios;
    return audios[0]?.currentTime ?? 0;
  })).toBeGreaterThan(0);
  expect(audioRequests.some((url) => url.endsWith("/audio/vocab/ai.ogg"))).toBe(true);
  await expect(cardButton).toHaveAttribute("aria-pressed", "false");

  // Replay from the summary then verify navigation disposes the active recording.
  await summaryButton.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { vocabularyTestAudios: HTMLAudioElement[] }).vocabularyTestAudios.length)).toBe(2);
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Tiếng Hàn từ con số 0", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { vocabularyTestAudios: HTMLAudioElement[] }).vocabularyTestAudios.every((audio) => audio.paused))).toBe(true);

  await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  await page.goto("/admin/lessons/l0000000-0000-4000-a000-000000000001/preview");
  await expect(page.getByRole("button", { name: "Nghe phát âm 아이", exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Nghe phát âm 아이", exact: true }).last()).toBeEnabled();
  await page.goto("/admin/lessons/l0000000-0000-4000-a000-000000000001/edit");
  await page.getByRole("button", { name: "+ Thêm từ vựng", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: 사과").fill("아이");
  await page.getByPlaceholder("/audio/vocab/sagwa.mp3").fill("/audio/vocab/ai.ogg");
  const preview = page.getByRole("button", { name: "Nghe phát âm 아이", exact: true });
  await expect(preview).toBeEnabled();
  const audioResponse = page.waitForResponse((response) => response.url().endsWith("/audio/vocab/ai.ogg"));
  await preview.click();
  expect((await audioResponse).status()).toBeLessThan(400);
});
