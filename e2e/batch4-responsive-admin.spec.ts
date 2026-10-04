import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { prisma } from "../src/shared/db/prisma";

test("protected and admin screens fit phone, tablet, and desktop; admin audio preview plays", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  const email = `batch4-layout-${randomUUID()}@example.com`;
  let userId: string | undefined;
  try {
    await page.goto("/dang-ky");
    await page.fill("#name", "Batch 4 layout tester");
    await page.fill("#email", email);
    await page.fill("#password", "Password123!");
    await page.fill("#confirmPassword", "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/dashboard", "/admin", "/admin/lessons/l0000000-0000-4000-a000-000000000001/edit"]) {
        const response = await page.goto(path);
        expect(response?.status(), `${path} at ${width}px`).toBe(200);
        await expect(page.locator("h1").first()).toBeVisible();
        const geometry = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          viewport: window.innerWidth,
          offenders: Array.from(document.querySelectorAll("body *"))
            .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 8)
            .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 65)}`),
        }));
        expect(geometry.document, `${path} document overflows at ${width}px: ${geometry.offenders.join(", ")}`).toBeLessThanOrEqual(geometry.viewport + 1);
        expect(geometry.body, `${path} body overflows at ${width}px: ${geometry.offenders.join(", ")}`).toBeLessThanOrEqual(geometry.viewport + 1);
      }
    }

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/admin/lessons/l0000000-0000-4000-a000-000000000001/edit");
    await page.getByRole("button", { name: /Thêm khối nội dung/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("select").first().selectOption("AUDIO");
    await dialog.getByLabel("Đường dẫn audio", { exact: true }).fill("/audio/lessons/korean-vowels.ogg");
    const preview = dialog.getByLabel("Nghe thử Đường dẫn audio");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("src", "/audio/lessons/korean-vowels.ogg");
    expect(await preview.evaluate(async (element) => {
      const audio = element as HTMLAudioElement;
      audio.load();
      if (audio.readyState < 1) await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("Audio preview could not load")), { once: true });
      });
      return audio.duration > 0;
    })).toBe(true);
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
  }
});
