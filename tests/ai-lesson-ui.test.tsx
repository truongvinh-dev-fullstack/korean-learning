// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import valid from "../docs/examples/ai/valid-lesson-generation.json";
import { AiLessonAuthoring } from "@/components/admin/ai-lesson/ai-lesson-authoring";
import { parseAiLessonDraft } from "@/modules/ai-lessons/ai-lesson-normalizer";
import { adminRequest, AdminApiError } from "@/modules/admin/admin.client";
import type { AiLessonPreview } from "@/modules/ai-lessons/ai-lesson.schema";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/modules/admin/admin.client", async (original) => ({ ...await original<typeof import("@/modules/admin/admin.client")>(), adminRequest: vi.fn() }));
const request = vi.mocked(adminRequest);
const chapterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function preview(): AiLessonPreview { const result = parseAiLessonDraft(valid); return { ...result, validationToken: "signed-preview" }; }
async function generate() { fireEvent.change(screen.getByLabelText("Chủ đề"), { target: { value: "10 nguyên âm" } }); fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp" })); await screen.findByTestId("ai-draft-preview"); }
beforeEach(() => { request.mockReset(); push.mockReset(); refresh.mockReset(); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps generate in preview, invalidates edits and requires revalidation before import", async () => {
  request.mockResolvedValue(preview()); render(<AiLessonAuthoring chapterId={chapterId} mock={false} />); await generate();
  expect(request.mock.calls.map((c) => c[0])).toEqual(["/api/admin/ai-lessons/generate"]);
  expect(screen.getByRole("button", { name: "Nhập vào bài học" })).toHaveProperty("disabled", false);
  fireEvent.change(screen.getByLabelText("Tiêu đề bản nháp"), { target: { value: "Edited" } });
  expect(screen.getByRole("button", { name: "Nhập vào bài học" })).toHaveProperty("disabled", true);
  request.mockImplementation(async (_url, _method, body) => ({ ...preview(), draft: (body as { draft: unknown }).draft }));
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại" })); await waitFor(() => expect(screen.getByRole("button", { name: "Nhập vào bài học" })).toHaveProperty("disabled", false));
  expect(request.mock.calls[1][0]).toBe("/api/admin/ai-lessons/validate"); expect((request.mock.calls[1][2] as { draft: { lesson: { title: string } } }).draft.lesson.title).toBe("Edited"); expect(push).not.toHaveBeenCalled();
});
it("does not submit an import when the admin cancels confirmation", async () => {
  request.mockResolvedValue(preview()); render(<AiLessonAuthoring chapterId={chapterId} mock={false} />); await generate(); vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Nhập vào bài học" })); expect(request).toHaveBeenCalledTimes(1);
});
it("requires a second explicit confirmation before replacing draft content", async () => {
  request.mockResolvedValue(preview()); render(<AiLessonAuthoring chapterId={chapterId} lessonId={chapterId} lessonStatus="DRAFT" mock={false} />); await generate();
  fireEvent.change(screen.getByLabelText("Cách nhập bản nháp"), { target: { value: "REPLACE" } }); fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Nhập vào bài học" })).toHaveProperty("disabled", false));
  vi.mocked(window.confirm).mockReturnValueOnce(true).mockReturnValueOnce(false); fireEvent.click(screen.getByRole("button", { name: "Nhập vào bài học" }));
  expect(request.mock.calls.map((call) => call[0])).toEqual(["/api/admin/ai-lessons/generate", "/api/admin/ai-lessons/validate"]); expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining("THAY TOÀN BỘ"));
});
it("locks generation against rapid double submit while the provider is pending", async () => {
  let resolve: (value: AiLessonPreview) => void = () => {}; request.mockReturnValue(new Promise<AiLessonPreview>((done) => { resolve = done; }));
  render(<AiLessonAuthoring chapterId={chapterId} mock={false} />); fireEvent.change(screen.getByLabelText("Chủ đề"), { target: { value: "Topic" } });
  const form = screen.getByRole("button", { name: "Tạo bản nháp" }).closest("form"); if (!form) throw new Error(); fireEvent.submit(form); fireEvent.submit(form); expect(request).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Đang tạo nội dung bài học..." })).toHaveProperty("disabled", true);
  resolve(preview()); await screen.findByTestId("ai-draft-preview");
});
it("retries a lost import response with the same key and draft, without allowing edits", async () => {
  request.mockResolvedValueOnce(preview()).mockRejectedValueOnce(new TypeError("Network interrupted")).mockResolvedValueOnce({ lessonId: "saved-lesson" });
  render(<AiLessonAuthoring chapterId={chapterId} mock={false} />); await generate(); fireEvent.click(screen.getByRole("button", { name: "Nhập vào bài học" }));
  const retry = await screen.findByRole("button", { name: "Thử lại nhập cùng yêu cầu" }); expect(screen.getByLabelText("Tiêu đề bản nháp").closest("fieldset")).toHaveProperty("disabled", true);
  fireEvent.click(retry); await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/lessons/saved-lesson/edit"));
  expect((request.mock.calls[1][2] as { idempotencyKey: string }).idempotencyKey).toBe((request.mock.calls[2][2] as { idempotencyKey: string }).idempotencyKey); expect(request.mock.calls[1][2]).toEqual(request.mock.calls[2][2]);
});
it("does not render a schema-invalid generated draft and keeps knowledge errors editable", async () => {
  request.mockResolvedValueOnce({ draft: null, validationToken: null, validation: { valid: false, schemaValid: false, errors: [{ code: "BAD", path: "contentBlocks.0", message: "Bad schema", severity: "ERROR" }], warnings: [], info: [] } });
  render(<AiLessonAuthoring chapterId={chapterId} mock={false} />); fireEvent.change(screen.getByLabelText("Chủ đề"), { target: { value: "Topic" } }); fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp" })); await screen.findByText("Schema: ✕ Không hợp lệ"); expect(screen.queryByTestId("ai-draft-preview")).toBeNull();
  const result = preview(); result.validation.valid = false; result.validation.errors = [{ code: "UNKNOWN", path: "exercises.0.questions.0", message: "Unknown vocabulary", severity: "ERROR" }]; result.validationToken = null; request.mockResolvedValueOnce(result);
  fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp" })); await screen.findByTestId("ai-draft-preview"); expect(screen.getByRole("button", { name: "Nhập vào bài học" })).toHaveProperty("disabled", true); expect(screen.getByRole("button", { name: "Sửa câu 1" })).toHaveProperty("disabled", false);
});
it("maps provider codes to safe Vietnamese errors", async () => {
  request.mockRejectedValue(new AdminApiError("private-provider-details", undefined, 504, "AI_PROVIDER_TIMEOUT"));
  render(<AiLessonAuthoring chapterId={chapterId} mock={false} />);
  fireEvent.change(screen.getByLabelText("Chủ đề"), { target: { value: "Topic" } }); fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
  await screen.findByText("AI tạo bài học mất quá nhiều thời gian. Vui lòng thử lại."); expect(screen.queryByText("private-provider-details")).toBeNull();
});
it("keeps generation metadata/token after edits and sends a fresh generation request ID", async () => {
  const data = preview(); data.generation = { requestId: crypto.randomUUID(), provider: "openai", model: "model", promptVersion: "lesson-authoring-v1", generatedAt: "2026-10-04T10:00:00.000Z", durationMs: 100, retryCount: 0 }; data.generationToken = "signed-generation";
  request.mockResolvedValue(data); render(<AiLessonAuthoring chapterId={chapterId} mock={false} />); await generate();
  expect((request.mock.calls[0][2] as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(screen.getByText(/AI tạo bản nháp · model/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Tiêu đề bản nháp"), { target: { value: "Edited" } }); fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Nhập vào bài học" })).toHaveProperty("disabled", false));
  expect((request.mock.calls[1][2] as { generationToken: string }).generationToken).toBe("signed-generation");
  fireEvent.click(screen.getByRole("button", { name: "Nhập vào bài học" })); await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect((request.mock.calls[2][2] as { generationToken: string }).generationToken).toBe("signed-generation");
});
