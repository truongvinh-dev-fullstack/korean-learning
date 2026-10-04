import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockType } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { adminService } from "@/modules/admin/admin.service";
import { ValidationError } from "@/shared/errors/domain-errors";
import { PUT } from "@/app/api/admin/blocks/[id]/route";

vi.mock("@/shared/auth/admin-guard", async (original) => ({
  ...await original<typeof import("@/shared/auth/admin-guard")>(),
  requireAdminApi: async () => ({ user: { role: "ADMIN" }, errorResponse: null }),
}));
const admin = { role: "ADMIN" };
const contents = {
  TEXT: { markdown: "Updated text" },
  HANGUL: { characters: [{ char: "가", romanization: "ga" }] },
  VOCABULARY: { items: [{ hangul: "물", romanization: "mul", vietnamese: "Nước", english: "Water" }] },
  GRAMMAR: { title: "Grammar", formula: "N", explanation: "Explanation", examples: [{ korean: "가", vietnamese: "Ví dụ" }] },
  DIALOGUE: { lines: [{ speaker: "A", korean: "안녕", vietnamese: "Chào" }] },
  AUDIO: { audioUrl: "/audio/vocab/mul.ogg" },
  CALLOUT: { message: "Updated note" },
  EXAMPLE: { items: [{ korean: "아이", vietnamese: "Em bé" }] },
  IMAGE: { imageUrl: "/images/lesson.png" },
};
let courseId: string, lessonId: string;
beforeEach(async () => {
  courseId = randomUUID();
  const course = await prisma.course.create({ data: {
    id: courseId, slug: `rc-${courseId}`, title: "RC", description: "RC",
    chapters: { create: { slug: `rc-${randomUUID()}`, title: "RC", lessons: { create: { slug: `rc-${randomUUID()}`, title: "RC" } } } },
  }, include: { chapters: { include: { lessons: true } } } });
  lessonId = course.chapters[0].lessons[0].id;
});
afterEach(async () => { await prisma.course.delete({ where: { id: courseId } }); });

describe("F1 existing blocks", () => {
  it.each(Object.values(BlockType))("edits and reloads %s", async (type) => {
    const block = await adminService.createBlock(admin, { lessonId, type, content: contents[type] });
    await adminService.updateBlock(admin, block.id, { content: { ...contents[type], title: "Persisted title" } });
    const reloaded = await prisma.lessonBlock.findUniqueOrThrow({ where: { id: block.id } });
    expect(reloaded.content).toMatchObject({ title: "Persisted title" });
    await adminService.updateBlock(admin, block.id, { displayOrder: 42 });
    expect(await prisma.lessonBlock.findUniqueOrThrow({ where: { id: block.id } })).toMatchObject({ displayOrder: 42, content: reloaded.content });
  });
  it.each(Object.values(BlockType))("rejects invalid %s content without persistence", async (type) => {
    const block = await adminService.createBlock(admin, { lessonId, type, content: contents[type] });
    await expect(adminService.updateBlock(admin, block.id, { content: {} })).rejects.toThrow(ValidationError);
    expect((await prisma.lessonBlock.findUniqueOrThrow({ where: { id: block.id } })).content).toEqual(block.content);
  });
  it("requires new content on type changes and removes incompatible fields", async () => {
    const block = await adminService.createBlock(admin, { lessonId, type: "TEXT", content: contents.TEXT });
    await expect(adminService.updateBlock(admin, block.id, { type: "AUDIO" })).rejects.toThrow(ValidationError);
    await expect(adminService.updateBlock(admin, block.id, { type: "AUDIO", content: contents.TEXT })).rejects.toThrow(ValidationError);
    const changed = await adminService.updateBlock(admin, block.id, { type: "AUDIO", content: { ...contents.TEXT, ...contents.AUDIO } });
    expect(changed.content).toEqual(contents.AUDIO);
  });
  it("saves through the actual API and returns a safe 400 for invalid data", async () => {
    const block = await adminService.createBlock(admin, { lessonId, type: "TEXT", content: contents.TEXT });
    const put = (body: object) => PUT(new NextRequest("http://localhost/api/admin/blocks/test", {
      method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
    }), { params: Promise.resolve({ id: block.id }) });
    expect((await put({ content: { markdown: "Saved via API" } })).status).toBe(200);
    expect((await prisma.lessonBlock.findUniqueOrThrow({ where: { id: block.id } })).content).toEqual({ markdown: "Saved via API" });
    const bad = await put({ type: "HANGUL", content: {} });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
