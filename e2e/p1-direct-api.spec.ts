import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { prisma } from "../src/shared/db/prisma";
import { enrollInSeedCourse, firstSeedAnswers } from "./helpers/learning";

const lesson1 = "l0000000-0000-4000-a000-000000000001";
const lesson2 = "l0000000-0000-4000-a000-000000000002";
const exercise1 = "e0000000-0000-4000-a000-000000000001";
const exercise2 = "e0000000-0000-4000-a000-000000000002";

test("P1 direct API requests enforce access and reject incomplete answers without solutions", async ({ page }) => {
  const email = `p1-api-${randomUUID()}@example.com`;
  let userId: string | undefined;
  try {
    await page.goto("/dang-ky");
    await page.fill("#name", "P1 API test");
    await page.fill("#email", email);
    await page.fill("#password", "Password123!");
    await page.fill("#confirmPassword", "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    const progress = (id: string, data: object) => page.request.post(`/api/lessons/${id}/progress`, { data });
    const submit = (id: string, answers: object[]) => page.request.post(`/api/exercises/${id}/submit`, { data: { answers } });
    expect((await progress(lesson1, { action: "START" })).status()).toBe(403);
    expect((await progress(lesson1, { action: "COMPLETE" })).status()).toBe(403);
    expect((await page.request.get(`/api/exercises/${exercise1}`)).status()).toBe(403);
    expect((await submit(exercise1, firstSeedAnswers)).status()).toBe(403);
    await page.goto("/courses/tieng-han-tu-con-so-0/lessons/bai-1-nguyen-am-co-ban");
    await expect(page.getByRole("button", { name: /Đăng ký khóa học ngay/i })).toBeVisible();
    await expect(page.getByText("Triết lý sáng tạo chữ Hangeul")).toHaveCount(0);
    await expect(page.locator("audio")).toHaveCount(0);

    await enrollInSeedCourse(page);
    await page.goto("/courses/tieng-han-tu-con-so-0/lessons/bai-2-phu-am-co-ban");
    await expect(page.getByText("Hoàn thành bài học trước để mở khóa bài này.")).toBeVisible();
    await expect(page.locator("audio")).toHaveCount(0);
    await page.goto("/courses/tieng-han-tu-con-so-0/lessons/bai-1-nguyen-am-co-ban");
    await expect(page.getByText("Triết lý sáng tạo chữ Hangeul")).toBeVisible();
    const audio = page.locator('audio[src="/audio/lessons/korean-vowels.ogg"]');
    await expect(audio).toBeVisible();
    const playbackReady = await audio.evaluate(async (element) => {
      const player = element as HTMLAudioElement;
      player.load();
      if (player.readyState < 1) await new Promise<void>((resolve, reject) => {
        player.addEventListener("loadedmetadata", () => resolve(), { once: true });
        player.addEventListener("error", () => reject(new Error("Audio decode failed")), { once: true });
      });
      return player.duration > 0;
    });
    expect(playbackReady).toBe(true);
    const published = await prisma.lesson.findMany({
      where: { status: "PUBLISHED", chapter: { status: "PUBLISHED", course: { status: "PUBLISHED" } } },
      include: { blocks: true, vocabularies: true, exercises: { where: { status: "PUBLISHED" }, include: { questions: true } } },
    });
    const audioUrls: string[] = [];
    const collectAudio = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(collectAudio); return; }
      if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
        if (key === "audioUrl" && typeof child === "string") audioUrls.push(child);
        else collectAudio(child);
      }
    };
    for (const lesson of published) {
      lesson.blocks.forEach((block) => collectAudio(block.content));
      lesson.vocabularies.forEach((vocabulary) => { if (vocabulary.audioUrl) audioUrls.push(vocabulary.audioUrl); });
      lesson.exercises.forEach((exercise) => exercise.questions.forEach((question) => { if (question.audioUrl) audioUrls.push(question.audioUrl); }));
    }
    expect(audioUrls.length).toBeGreaterThanOrEqual(4);
    for (const url of new Set(audioUrls)) {
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("audio/ogg");
      expect((await response.body()).subarray(0, 4).toString()).toBe("OggS");
    }
    await prisma.lessonProgress.deleteMany({ where: { userId, lessonId: lesson1 } });
    const simultaneousStarts = await Promise.all(Array.from({ length: 8 }, () => progress(lesson1, { action: "START" })));
    expect(simultaneousStarts.map((response) => response.status())).toEqual(Array(8).fill(200));
    expect(await prisma.lessonProgress.count({ where: { userId, lessonId: lesson1 } })).toBe(1);
    expect((await progress(lesson2, { action: "START" })).status()).toBe(403);
    expect((await progress(lesson2, { action: "COMPLETE" })).status()).toBe(403);
    expect((await page.request.get(`/api/exercises/${exercise2}`)).status()).toBe(403);
    expect((await submit(exercise2, firstSeedAnswers)).status()).toBe(403);
    expect((await progress(lesson1, { action: "COMPLETE", score: 100 })).status()).toBe(400);
    expect((await progress(lesson1, { action: "COMPLETE" })).status()).toBe(409);
    expect((await page.request.get(`/api/exercises/${exercise1}`)).status()).toBe(200);

    const invalidSets = [
      [],
      firstSeedAnswers.slice(0, 3),
      [...firstSeedAnswers, firstSeedAnswers[0]],
      [...firstSeedAnswers.slice(0, 3), { questionId: randomUUID(), textAnswer: "유" }],
      [{ ...firstSeedAnswers[0], selectedOptionId: "not-an-option" }, ...firstSeedAnswers.slice(1)],
    ];
    for (const answers of invalidSets) {
      const response = await submit(exercise1, answers);
      expect([400, 422]).toContain(response.status());
      const body = JSON.stringify(await response.json());
      expect(body).not.toMatch(/correctAnswerDisplay|explanation|isCorrect/);
    }
    expect(await prisma.exerciseAttempt.count({ where: { userId } })).toBe(0);
    expect((await progress(lesson1, { action: "COMPLETE" })).status()).toBe(409);

    const failing = await submit(exercise1, [
      { ...firstSeedAnswers[0], selectedOptionId: "o0000000-0000-4000-a000-000000000002" },
      ...firstSeedAnswers.slice(1),
    ]);
    expect(failing.status()).toBe(200);
    expect((await failing.json()).data.isPassing).toBe(false);
    expect((await progress(lesson1, { action: "COMPLETE" })).status()).toBe(409);

    const passing = await submit(exercise1, firstSeedAnswers);
    expect(passing.status()).toBe(200);
    expect((await passing.json()).data.isPassing).toBe(true);
    expect((await progress(lesson2, { action: "START" })).status()).toBe(200);

    const statuses = await prisma.lesson.findMany({
      where: { id: { in: [4, 5, 6, 7, 8].map((n) => `l0000000-0000-4000-a000-${String(n).padStart(12, "0")}`) } },
      select: { status: true },
    });
    expect(statuses).toHaveLength(5);
    expect(statuses.every((lesson) => lesson.status === "DRAFT")).toBe(true);
    await page.goto("/courses/tieng-han-tu-con-so-0/lessons/bai-4-cac-cau-chao-hoi-thong-dung");
    await expect(page.locator("h1")).toContainText("Không tìm thấy trang");
    await page.goto("/courses/tieng-han-tu-con-so-0");
    expect(await page.locator('a[href*="bai-4-cac-cau-chao-hoi-thong-dung"]').count()).toBe(0);
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
  }
});

test("P1 admin DELETE APIs return conflict when descendant attempts exist", async ({ page }) => {
  const token = randomUUID();
  const adminEmail = `p1-admin-${token}@example.com`;
  const userId = randomUUID();
  const courseId = randomUUID();
  const chapterId = randomUUID();
  const lessonId = randomUUID();
  let adminId: string | undefined;
  let courseCreated = false;
  let userCreated = false;
  try {
    await page.goto("/dang-ky");
    await page.fill("#name", "P1 admin");
    await page.fill("#email", adminEmail);
    await page.fill("#password", "Password123!");
    await page.fill("#confirmPassword", "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    const promoted = await prisma.user.update({ where: { email: adminEmail }, data: { role: "ADMIN" } });
    adminId = promoted.id;
    await prisma.user.create({ data: { id: userId, email: `p1-student-${token}@example.com`, name: "P1 student", role: "STUDENT" } });
    userCreated = true;
    await prisma.course.create({ data: { id: courseId, slug: `p1-${token}`, title: "P1 draft", description: "P1 test", status: "DRAFT" } });
    courseCreated = true;
    await prisma.chapter.create({ data: { id: chapterId, courseId, slug: `p1-${chapterId}`, title: "P1 chapter", status: "DRAFT" } });
    await prisma.lesson.create({ data: { id: lessonId, chapterId, slug: `p1-${lessonId}`, title: "P1 lesson", status: "DRAFT" } });
    const exercise = await prisma.exercise.create({ data: { lessonId, title: "P1 exercise", status: "DRAFT" } });
    await prisma.exerciseAttempt.create({ data: { userId, exerciseId: exercise.id, submittedAt: new Date() } });

    await page.goto("/admin");
    const chapterResponse = await page.request.delete(`/api/admin/chapters/${chapterId}`);
    const courseResponse = await page.request.delete(`/api/admin/courses/${courseId}`);
    expect(chapterResponse.status()).toBe(409);
    expect(courseResponse.status()).toBe(409);
    expect((await chapterResponse.json()).error.message).toMatch(/Không thể xóa/);
    expect((await courseResponse.json()).error.message).toMatch(/Không thể xóa/);
    expect(await prisma.exerciseAttempt.count({ where: { userId } })).toBe(1);
  } finally {
    if (courseCreated) await prisma.course.delete({ where: { id: courseId } });
    if (userCreated) await prisma.user.delete({ where: { id: userId } });
    if (adminId) await prisma.user.delete({ where: { id: adminId } });
  }
});
