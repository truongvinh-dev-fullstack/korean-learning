import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { prisma } from "../src/shared/db/prisma";
import sample from "../docs/examples/lesson-1-vowels.json";
import type { SupportedBlockType } from "../src/modules/lessons/lesson-block.schema";
import type { SupportedQuestionType } from "../src/modules/exercises/question.schema";

let userId: string, courseId: string, lessonId: string;
const dialog = (page: Page) => page.getByRole("dialog");
const field = (root: Locator, label: string) => root.getByLabel(label, { exact: true });
const button = (root: Page | Locator, name: string) => root.getByRole("button", { name, exact: true });
async function saved(page: Page, label: string) {
  await button(dialog(page), label).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}
async function reordered(page: Page, label: string) {
  const response = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/reorder"));
  await button(page, label).click(); expect((await response).status()).toBe(200); await page.waitForLoadState("networkidle");
}
async function createViaApi(page: Page, path: string, data: object): Promise<string> {
  const response = await page.request.post(path, { data });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data.id;
}
async function snapshot() {
  return prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: {
    blocks: { orderBy: { displayOrder: "asc" } }, vocabularies: { orderBy: { displayOrder: "asc" } },
    exercises: { orderBy: { displayOrder: "asc" }, include: { questions: { orderBy: { displayOrder: "asc" }, include: { options: { orderBy: { displayOrder: "asc" } } } } } },
  } });
}
test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", (popup) => popup.accept());
  const email = `detail-qa-${randomUUID()}@example.com`;
  await page.goto("/dang-ky");
  await page.fill("#name", "Lesson Detail QA"); await page.fill("#email", email);
  await page.fill("#password", "Password123!"); await page.fill("#confirmPassword", "Password123!");
  await button(page, "Đăng ký tài khoản").click(); await expect(page).toHaveURL(/dashboard/);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } }); userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  courseId = await createViaApi(page, "/api/admin/courses", { title: "QA course", slug: `qa-${randomUUID()}`, description: "QA" });
  const chapterId = await createViaApi(page, "/api/admin/chapters", { courseId, title: "QA chapter", slug: "chapter" });
  lessonId = await createViaApi(page, "/api/admin/lessons", { chapterId, title: sample.lesson.title, slug: `qa-${randomUUID()}` });
  await page.goto(`/admin/lessons/${lessonId}/edit`);
  await expect(page.getByRole("heading", { name: /1. Thông tin chung/ })).toBeVisible();
});
test.afterEach(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  if (courseId) await prisma.course.deleteMany({ where: { id: courseId } });
});

async function addWord(page: Page, word: typeof sample.vocabulary[number]) {
  await button(page, "+ Thêm từ vựng").click();
  for (const [label, value] of [["Từ tiếng Hàn (Hangeul)", word.hangul], ["Phiên âm", word.romanization], ["Nghĩa tiếng Việt", word.vietnameseMeaning], ["Nghĩa tiếng Anh", word.englishMeaning]] ) {
    await field(dialog(page), label).fill(value);
  }
  await field(dialog(page), "Độ khó").selectOption("1");
  await field(dialog(page), "Từ loại").fill(word.partOfSpeech);
  for (const tag of word.tags) { await button(dialog(page), "+ Thêm nhãn từ vựng").click(); await dialog(page).getByLabel(/^Nhãn từ vựng \d+$/).last().fill(tag); }
  if (word.audioUrl) await field(dialog(page), "Audio từ vựng").fill(word.audioUrl);
  await saved(page, "Lưu từ vựng");
}
async function startBlock(page: Page, type: SupportedBlockType, title = `QA ${type}`) {
  await button(page, "+ Thêm khối nội dung").click();
  await field(dialog(page), "Loại khối nội dung").selectOption(type);
  await field(dialog(page), "Tiêu đề khối").fill(title);
}
async function addExamples(page: Page, name: string) {
  for (const [korean, vietnamese] of [["아이", "Em bé"], ["오이", "Dưa chuột"], ["discard", "discard"]]) {
    await button(dialog(page), `+ Thêm ${name}`).click();
    await dialog(page).getByLabel("Tiếng Hàn", { exact: true }).last().fill(korean);
    await dialog(page).getByLabel("Tiếng Việt", { exact: true }).last().fill(vietnamese);
  }
  const label = name === "ví dụ" ? "Ví dụ" : "Lượt hội thoại";
  await button(dialog(page), `Xóa ${label} 3`).click();
  await button(dialog(page), `Đưa lên ${label} 2`).click();
}

test("all nine blocks persist create/edit/reorder/delete, readable previews and responsive editors", async ({ page }) => {
  await addWord(page, sample.vocabulary[0]);
  const types: SupportedBlockType[] = ["TEXT", "HANGUL", "VOCABULARY", "GRAMMAR", "EXAMPLE", "DIALOGUE", "AUDIO", "IMAGE", "CALLOUT"];
  for (const type of types) {
    await startBlock(page, type);
    await button(dialog(page), "Lưu khối nội dung").click();
    await expect(dialog(page)).toBeVisible(); // Empty critical fields never reach persistence.
    expect(await prisma.lessonBlock.count({ where: { lessonId, type } })).toBe(0);
    switch (type) {
      case "TEXT": await field(dialog(page), "Nội dung văn bản / Markdown").fill("Bảng chữ cái tiếng Hàn"); break;
      case "HANGUL":
        for (const char of ["ㅏ", "ㅓ", "discard"]) {
          await button(dialog(page), "+ Thêm ký tự").click();
          await dialog(page).getByLabel("Ký tự Hangeul", { exact: true }).last().fill(char);
          await dialog(page).getByLabel("Phiên âm", { exact: true }).last().fill("a");
        }
        await button(dialog(page), "Xóa Ký tự 3").click(); await button(dialog(page), "Đưa lên Ký tự 2").click(); break;
      case "VOCABULARY": await dialog(page).getByRole("checkbox", { name: /아이 —/ }).check(); break;
      case "GRAMMAR":
        await field(dialog(page), "Cấu trúc ngữ pháp").fill("N + 은/는"); await field(dialog(page), "Giải thích").fill("Tiểu từ chủ đề");
        for (const rule of ["Có phụ âm cuối", "Không có phụ âm cuối", "discard"]) {
          await button(dialog(page), "+ Thêm quy tắc").click(); await dialog(page).getByLabel(/^Quy tắc \d+$/).last().fill(rule);
        }
        await button(dialog(page), "Xóa Quy tắc 3").click(); await button(dialog(page), "Đưa lên Quy tắc 2").click();
        await addExamples(page, "ví dụ"); break;
      case "EXAMPLE": await addExamples(page, "ví dụ"); break;
      case "DIALOGUE":
        await addExamples(page, "lượt hội thoại");
        await dialog(page).getByLabel("Người nói", { exact: true }).nth(0).fill("A");
        await dialog(page).getByLabel("Người nói", { exact: true }).nth(1).fill("B"); break;
      case "AUDIO": await field(dialog(page), "Đường dẫn audio").fill("/audio/lessons/korean-vowels.ogg"); break;
      case "IMAGE": await field(dialog(page), "Đường dẫn hình ảnh").fill("/next.svg"); await field(dialog(page), "Chú thích hình").fill("Bảng chữ cái"); break;
      case "CALLOUT": await field(dialog(page), "Thông điệp").fill("Ghi nhớ nguyên âm"); break;
    }
    await saved(page, "Lưu khối nội dung"); await page.reload();
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: `QA ${type}`, exact: true }) });
    await expect(card).toBeVisible(); expect(await card.innerText()).not.toMatch(/\{"|"items":/);
    const stored = await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId, type } });
    await button(card, "Sửa").click();
    await field(dialog(page), "Tiêu đề khối").fill(`Edited ${type}`); await saved(page, "Lưu khối nội dung");
    await page.reload();
    expect((await prisma.lessonBlock.findUniqueOrThrow({ where: { id: stored.id } })).content).toEqual({ ...Object(stored.content), title: `Edited ${type}` });
    if (type !== "TEXT") {
      await reordered(page, `Đưa lên khối ${types.indexOf(type) + 1}`);
      await page.reload(); const order = (await snapshot()).blocks;
      expect(order[types.indexOf(type) - 1].id).toBe(stored.id);
      expect(new Set(order.map((block) => block.displayOrder)).size).toBe(order.length);
    }
  }
  await page.goto(`/admin/lessons/${lessonId}/preview`);
  for (const type of types) await expect(page.getByRole("heading", { name: `Edited ${type}`, exact: true })).toBeVisible();
  await page.goto(`/admin/lessons/${lessonId}/edit`);
  const before = await snapshot();
  for (const width of [1920, 1440, 1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("table")).toBeVisible();
    await button(page, "+ Thêm khối nội dung").click(); await field(dialog(page), "Loại khối nội dung").selectOption("HANGUL");
    for (let i = 0; i < 4; i++) await button(dialog(page), "+ Thêm ký tự").click();
    const bounds = await dialog(page).locator(":scope > div").boundingBox();
    expect(bounds).not.toBeNull(); if (bounds) { expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(900); }
    await button(dialog(page), "Lưu khối nội dung").scrollIntoViewIfNeeded();
    await expect(button(dialog(page), "Lưu khối nội dung")).toBeInViewport();
    await page.screenshot({ path: `.temp/lesson-detail-modal-${width}.png` });
    await button(dialog(page), "Đóng trình soạn thảo").click();
    await page.screenshot({ path: `.temp/lesson-detail-${width}.png`, fullPage: true });
  }
  expect(await snapshot()).toEqual(before); // Closing dirty modals never auto-saves.
  for (const type of types) {
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: `Edited ${type}`, exact: true }) });
    await button(card, "Xóa").click(); await button(dialog(page), "Xác nhận xóa").click();
    await expect(dialog(page)).toHaveCount(0); await page.waitForLoadState("networkidle"); await page.reload();
    expect(await prisma.lessonBlock.count({ where: { lessonId, type } })).toBe(0);
  }
  expect(await prisma.vocabulary.count({ where: { lessonId } })).toBe(1);
});

async function addQuestion(page: Page, type: SupportedQuestionType, prompt: string, choices = ["아이", "오이"], correct = 0, explanation = "") {
  await button(page, "+ Thêm câu hỏi").click(); await field(dialog(page), "Loại câu hỏi").selectOption(type);
  await field(dialog(page), "Đề bài câu hỏi").fill(prompt);
  await field(dialog(page), "Giải thích đáp án").fill(explanation);
  switch (type) {
    case "MULTIPLE_CHOICE": case "MULTIPLE_SELECT": case "LISTENING_CHOICE": case "ARRANGE_SENTENCE":
      for (let i = 0; i < choices.length; i++) {
        if (i >= 2) await button(dialog(page), type === "ARRANGE_SENTENCE" ? "+ Thêm thẻ từ" : "+ Thêm lựa chọn").click();
        await field(dialog(page), `${type === "ARRANGE_SENTENCE" ? "Thẻ từ" : "Lựa chọn"} ${i + 1}`).fill(choices[i]);
      }
      if (type === "ARRANGE_SENTENCE") await field(dialog(page), "Đáp án chuẩn").fill(choices.join(" "));
      else await dialog(page).getByRole(type === "MULTIPLE_SELECT" ? "checkbox" : "radio").nth(correct).check();
      if (type === "LISTENING_CHOICE") await field(dialog(page), "Audio câu hỏi nghe").fill("/audio/exercises/vowel-a.ogg");
      break;
    case "TRUE_FALSE": await field(dialog(page), "Đáp án đúng").selectOption("false"); break;
    case "FILL_BLANK": await field(dialog(page), "Đáp án chấp nhận 1").fill("유"); break;
    case "MATCHING":
      for (let i = 0; i < 2; i++) { await button(dialog(page), "+ Thêm cặp ghép").click(); await dialog(page).getByLabel("Vế trái", { exact: true }).last().fill(choices[i]); await dialog(page).getByLabel("Vế phải", { exact: true }).last().fill(["Em bé", "Dưa chuột"][i]); } break;
    case "ORDERING":
      for (let i = 0; i < 3; i++) { await button(dialog(page), "+ Thêm mục sắp xếp").click(); await field(dialog(page), `Mục ${i + 1}`).fill(String(i)); }
      await button(dialog(page), "Xóa Mục sắp xếp 3").click(); await button(dialog(page), "Đưa lên Mục sắp xếp 2").click(); break;
    case "TRANSLATION": await field(dialog(page), "Câu cần dịch").fill("아이"); await field(dialog(page), "Bản dịch chấp nhận 1").fill("Em bé"); break;
    case "WRITING": case "PRONUNCIATION":
      await expect(dialog(page).getByText(/Chấm thủ công/)).toBeVisible(); await field(dialog(page), type === "WRITING" ? "Yêu cầu viết" : "Yêu cầu phát âm").fill("아이"); break;
  }
  await saved(page, "Lưu câu hỏi");
}
async function addExercise(page: Page, title: string, description = "") {
  await button(page, "+ Thêm bài tập").click(); await field(dialog(page), "Tiêu đề bài tập").fill(title); await field(dialog(page), "Mô tả bài tập").fill(description); await saved(page, "Lưu bài tập");
}

test("all question editors persist discriminated content and draft-only manual grading", async ({ page }) => {
  await addExercise(page, "QA question types");
  const types: SupportedQuestionType[] = ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "FILL_BLANK", "MATCHING", "ORDERING", "LISTENING_CHOICE", "TRANSLATION", "WRITING", "PRONUNCIATION", "ARRANGE_SENTENCE"];
  for (const type of types) {
    await addQuestion(page, type, `QA ${type}`); await page.reload();
    const question = await prisma.question.findFirstOrThrow({ where: { exercise: { lessonId }, type }, include: { options: { orderBy: { displayOrder: "asc" } } } });
    if (type === "TRUE_FALSE") expect(question.content).toEqual({ correctAnswer: false });
    const row = page.locator("article > div.space-y-2 > div").filter({ hasText: `QA ${type}` });
    await button(row, "Sửa câu hỏi").click(); await field(dialog(page), "Đề bài câu hỏi").fill(`Edited ${type}`);
    await saved(page, "Lưu câu hỏi"); await page.reload();
    const reloaded = await prisma.question.findUniqueOrThrow({ where: { id: question.id }, include: { options: { orderBy: { displayOrder: "asc" } } } });
    expect(reloaded.content).toEqual(question.content); expect(reloaded.options.map(({ id, text, isCorrect, createdAt }) => ({ id, text, isCorrect, createdAt }))).toEqual(question.options.map(({ id, text, isCorrect, createdAt }) => ({ id, text, isCorrect, createdAt })));
  }
  await expect(page.getByText("Chấm thủ công · Chưa hỗ trợ tự động chấm", { exact: true })).toHaveCount(2);
  await button(page, "Sửa bài tập").click(); await field(dialog(page), "Trạng thái bài tập").selectOption("PUBLISHED");
  await button(dialog(page), "Lưu bài tập").click(); await expect(dialog(page).getByRole("alert")).toContainText(/chấm thủ công/);
  expect((await snapshot()).exercises[0].status).toBe("DRAFT"); await button(dialog(page), "Đóng trình soạn thảo").click();
  await reordered(page, "Đưa lên câu hỏi 11"); await page.reload();
  expect((await snapshot()).exercises[0].questions[9].type).toBe("ARRANGE_SENTENCE");
  for (const type of types) {
    const row = page.locator("article > div.space-y-2 > div").filter({ hasText: `Edited ${type}` });
    await button(row, "Xóa câu hỏi").click(); await button(dialog(page), "Xác nhận xóa").click();
    await expect(dialog(page)).toHaveCount(0); await page.waitForLoadState("networkidle");
  }
  await page.reload(); expect((await snapshot()).exercises[0].questions).toHaveLength(0);
  await button(page, "Xóa bài tập").click(); await button(dialog(page), "Xác nhận xóa").click(); await expect(dialog(page)).toHaveCount(0);
  await page.reload(); expect((await snapshot()).exercises).toHaveLength(0);
});

test("complete vowel sample survives real form save, reload, edit and ordering in every section", async ({ page }) => {
  await page.getByLabel("Thời lượng ước tính (phút)", { exact: true }).fill(String(sample.lesson.estimatedMinutes));
  await page.getByLabel("Cấp độ bài học", { exact: true }).fill(sample.lesson.level);
  await page.getByLabel("Tóm tắt bài học", { exact: true }).fill(sample.lesson.summary);
  for (const tag of sample.lesson.tags) { await button(page, "+ Thêm nhãn").click(); await page.getByLabel(/^Nhãn \d+$/).last().fill(tag); }
  for (const objective of sample.lesson.learningObjectives) { await button(page, "+ Thêm mục tiêu").click(); await page.getByLabel(/^Mục tiêu \d+$/).last().fill(objective); }
  await button(page, "Lưu mục tiêu").click(); await expect(page.getByText("Đã lưu mục tiêu bài học.")).toBeVisible(); await page.waitForLoadState("networkidle");
  for (const word of sample.vocabulary) await addWord(page, word);
  for (const block of sample.contentBlocks) {
    const type = block.type as SupportedBlockType;
    await startBlock(page, type, block.content.title);
    if (type === "TEXT") await field(dialog(page), "Nội dung văn bản / Markdown").fill(sample.contentBlocks[0].content.markdown ?? "");
    if (type === "HANGUL") {
      await field(dialog(page), "Mô tả").fill(sample.contentBlocks[1].content.description ?? "");
      for (const char of sample.contentBlocks[1].content.characters ?? []) {
      await button(dialog(page), "+ Thêm ký tự").click(); await dialog(page).getByLabel("Ký tự Hangeul", { exact: true }).last().fill(char.char);
      await dialog(page).getByLabel("Phiên âm", { exact: true }).last().fill(char.romanization);
      await dialog(page).getByLabel("Gợi ý phát âm", { exact: true }).last().fill(char.soundHint);
      await dialog(page).getByLabel("Số nét", { exact: true }).last().fill(String(char.strokeCount));
      if (char.example) {
        await dialog(page).getByRole("checkbox", { name: "Có từ ví dụ", exact: true }).last().check();
        await dialog(page).getByLabel("Từ ví dụ", { exact: true }).last().fill(char.example.hangul);
        await dialog(page).getByLabel("Phiên âm ví dụ", { exact: true }).last().fill(char.example.romanization);
        await dialog(page).getByLabel("Nghĩa ví dụ", { exact: true }).last().fill(char.example.vietnamese);
      }
      }
    }
    if (type === "VOCABULARY") for (const word of sample.vocabulary) await dialog(page).getByRole("checkbox", { name: new RegExp(`${word.hangul} —`) }).check();
    if (type === "AUDIO") { await field(dialog(page), "Đường dẫn audio").fill("/audio/lessons/korean-vowels.ogg"); await field(dialog(page), "Chú thích").fill(sample.contentBlocks[3].content.caption ?? ""); }
    if (type === "CALLOUT") { await field(dialog(page), "Thông điệp").fill(sample.contentBlocks[4].content.message ?? ""); await field(dialog(page), "Kiểu ghi chú").selectOption("remember"); }
    await saved(page, "Lưu khối nội dung");
  }
  await addExercise(page, sample.exercises[0].title, sample.exercises[0].description);
  for (const question of sample.exercises[0].questions) await addQuestion(page, question.type as SupportedQuestionType, question.prompt, question.options.map((option) => option.text), Math.max(0, question.options.findIndex((option) => option.isCorrect)), question.explanation);
  await button(page, "Sửa bài tập").click(); await field(dialog(page), "Trạng thái bài tập").selectOption("PUBLISHED"); await saved(page, "Lưu bài tập");
  await page.getByLabel("Trạng thái xuất bản", { exact: true }).selectOption("PUBLISHED"); await button(page, "Lưu thông tin bài học").click(); await expect(page.getByText("Đã lưu thông tin bài học.")).toBeVisible();
  await page.waitForLoadState("networkidle"); const initial = await snapshot(); await page.reload(); expect(await snapshot()).toEqual(initial);
  expect(initial.blocks.map((block) => block.type)).toEqual(["TEXT", "HANGUL", "VOCABULARY", "AUDIO", "CALLOUT"]);
  expect(initial.vocabularies.map((word) => word.hangul)).toEqual(["아이", "오이", "우유", "이유", "여우"]);
  expect(initial.exercises[0].questions.map((question) => question.type)).toEqual(["MULTIPLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "LISTENING_CHOICE"]);
  const wordRow = page.locator("tr").filter({ hasText: "Em bé" }); await button(wordRow, "Sửa").click(); await field(dialog(page), "Nghĩa tiếng Việt").fill("Em bé — đã sửa"); await saved(page, "Lưu từ vựng");
  const textCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Làm quen với nguyên âm", exact: true }) });
  await button(textCard, "Sửa").click(); await field(dialog(page), "Nội dung văn bản / Markdown").fill("Nội dung đã sửa; 10 nguyên âm cơ bản."); await saved(page, "Lưu khối nội dung");
  await button(page, "Sửa câu hỏi").nth(2).click(); await field(dialog(page), "Đáp án chấp nhận 1").fill("유"); await field(dialog(page), "Đề bài câu hỏi").fill("Điền âm tiết: 우___"); await saved(page, "Lưu câu hỏi");
  await button(page, "Đưa lên Mục tiêu 4").click();
  for (const label of ["Đưa lên khối 5", "Đưa lên từ 5", "Đưa lên câu hỏi 4"]) await reordered(page, label);
  const objectiveSaved = page.waitForResponse((response) => response.url().endsWith(`/api/admin/lessons/${lessonId}`) && response.request().method() === "PUT");
  await button(page, "Lưu mục tiêu").click(); expect((await objectiveSaved).status()).toBe(200); await page.waitForLoadState("networkidle");
  const edited = await snapshot(); await page.reload(); expect(await snapshot()).toEqual(edited);
  await page.waitForLoadState("networkidle"); let idleRequests = 0;
  page.on("request", (request) => { if (request.url().includes("/api/admin/")) idleRequests++; });
  await page.waitForTimeout(1000); expect(idleRequests).toBe(0);
  await page.screenshot({ path: ".temp/lesson-detail-vowels-persisted.png", fullPage: true });
  expect(edited.learningObjectives[2]).toBe(sample.lesson.learningObjectives[3]); expect(edited.blocks[3].type).toBe("CALLOUT");
  expect(edited.vocabularies[3].hangul).toBe("여우"); expect(edited.exercises[0].questions[2].type).toBe("LISTENING_CHOICE");
  for (const rows of [edited.blocks, edited.vocabularies, edited.exercises, edited.exercises[0].questions]) expect(new Set(rows.map((row) => row.displayOrder)).size).toBe(rows.length);
  await page.goto(`/admin/lessons/${lessonId}/preview`); await expect(page.getByText("Em bé — đã sửa", { exact: true }).first()).toBeVisible();
  const reference = edited.blocks.find((block) => block.type === "VOCABULARY"); expect(reference?.content).toMatchObject({ vocabularyIds: initial.vocabularies.map((word) => word.id) });
});

test("legacy fields survive real API/form round-trips; conversion is explicit and failed saves preserve data", async ({ page, expectedServerErrors }) => {
  const legacy = [
    { type: "TEXT", content: { title: "Legacy TEXT", markdown: "Old text", teacherNote: "Preserve" } },
    { type: "HANGUL", content: { title: "Legacy HANGUL", characters: [{ char: "ㅏ", romanization: "a", strokeImage: "/guide.svg" }], teacherNote: "Preserve" } },
    { type: "VOCABULARY", content: { title: "Legacy VOCABULARY", items: [{ hangul: "아이", romanization: "ai", vietnamese: "Em bé", teacherNote: "Preserve word" }], sourceCredit: "Preserve" } },
    { type: "AUDIO", content: { title: "Legacy AUDIO", audioUrl: "/audio/vocab/ai.ogg", sourceCredit: "Preserve" } },
    { type: "CALLOUT", content: { title: "Legacy CALLOUT", variant: "info", message: "Remember", teacherNote: "Preserve" } },
  ] as const;
  for (const [index, fixture] of legacy.entries()) {
    const id = await createViaApi(page, `/api/admin/lessons/${lessonId}/blocks`, { ...fixture, displayOrder: index });
    await page.reload();
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: fixture.content.title, exact: true }) });
    await button(card, "Sửa").click(); await saved(page, "Lưu khối nội dung"); await page.reload();
    expect((await prisma.lessonBlock.findUniqueOrThrow({ where: { id } })).content).toMatchObject(fixture.content);
  }
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Legacy TEXT", exact: true }) });
  await button(card, "Sửa").click(); await field(dialog(page), "Nội dung văn bản / Markdown").fill("Unsaved");
  await button(dialog(page), "Đóng trình soạn thảo").click(); await page.reload(); await expect(card).toContainText("Old text");
  const textBlock = await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId, type: "TEXT" } });
  expectedServerErrors.push({ path: `/api/admin/blocks/${textBlock.id}`, method: "PUT", status: 500 });
  await page.route(`**/api/admin/blocks/${textBlock.id}`, (route) => route.request().method() === "PUT" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "QA API failure" } }) }) : route.continue());
  await button(card, "Sửa").click(); await field(dialog(page), "Nội dung văn bản / Markdown").fill("Failed edit");
  await button(dialog(page), "Lưu khối nội dung").click(); await expect(dialog(page).getByRole("alert")).toContainText("QA API failure");
  await expect(card).toContainText("Old text"); await button(dialog(page), "Đóng trình soạn thảo").click(); await page.unroute(`**/api/admin/blocks/${textBlock.id}`);
  await addWord(page, sample.vocabulary[0]);
  const vocabularyCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Legacy VOCABULARY", exact: true }) });
  await button(vocabularyCard, "Sửa").click(); await button(dialog(page), "Chuyển sang chọn từ trong ngân hàng").click();
  await button(dialog(page), "Đóng trình soạn thảo").click(); await page.reload();
  expect((await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId, type: "VOCABULARY" } })).content).toMatchObject({ items: legacy[2].content.items });
  await button(vocabularyCard, "Sửa").click(); await button(dialog(page), "Chuyển sang chọn từ trong ngân hàng").click();
  await dialog(page).getByRole("checkbox", { name: /아이 —/ }).check(); await saved(page, "Lưu khối nội dung"); await page.reload();
  const bank = await prisma.vocabulary.findFirstOrThrow({ where: { lessonId } });
  expect((await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId, type: "VOCABULARY" } })).content).toEqual({ title: "Legacy VOCABULARY", vocabularyIds: [bank.id], sourceCredit: "Preserve" });
  expect((await page.request.delete(`/api/admin/vocabularies/${bank.id}`)).status()).toBe(409);
});
