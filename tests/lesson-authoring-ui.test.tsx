// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LessonBlocksEditor } from "@/components/admin/lesson-blocks-editor";
import { QuestionEditor } from "@/components/admin/lesson-detail/question-editor";
import { LessonObjectives } from "@/components/admin/lesson-detail/lesson-objectives";
import { createQuestionForm, mapQuestionFormToPayload } from "@/modules/admin/lesson-detail.mapper";
import { QuestionFields } from "@/components/admin/lesson-detail/question-fields";
import { useAdminCollection } from "@/components/admin/lesson-detail/use-admin-collection";
import { adminRequest } from "@/modules/admin/admin.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Lesson editors use fields instead of raw JSON", () => {
  it("lets the server append new questions instead of implicitly inserting each at zero", () => {
    const form = createQuestionForm("TRUE_FALSE"); form.prompt = "True?";
    expect(mapQuestionFormToPayload("exercise", form).displayOrder).toBeUndefined();
  });
  it("loads a legacy grammar form and saves canonical fields without losing multiple examples/audio", async () => {
    const content = { title: "Grammar", formula: "N", explanation: "Old description", examples: [
      { korean: "아이", vietnamese: "Em bé", audioUrl: "/audio/vocab/ai.ogg" }, { korean: "오이", vietnamese: "Dưa chuột" },
    ] };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) }); vi.stubGlobal("fetch", fetch);
    render(<LessonBlocksEditor lessonId="lesson" initialBlocks={[{ id: "block", lessonId: "lesson", type: "GRAMMAR", content, displayOrder: 0 }]} />);
    expect(screen.queryByText(/"formula"/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Sửa$/ }));
    expect(screen.getByLabelText("Cấu trúc ngữ pháp")).toHaveProperty("value", "N");
    expect(screen.getAllByLabelText("Tiếng Hàn")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Cấu trúc ngữ pháp"), { target: { value: "N + suffix" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu khối nội dung" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const saved = JSON.parse(fetch.mock.calls[0][1].body);
    expect(saved.content).toMatchObject({ pattern: "N + suffix", formula: "N + suffix", description: "Old description", examples: content.examples });
  });
  it("shows question validation at the option fields and permits variable choice counts", async () => {
    const onErrors = vi.fn(), onSave = vi.fn();
    render(<QuestionEditor exerciseId="exercise" busy={false} errors={{}} error={null} onErrors={onErrors} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Đề bài câu hỏi"), { target: { value: "Choose" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu câu hỏi" }));
    expect(onErrors.mock.calls[0][0]).toHaveProperty("options.0.text"); expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Lựa chọn 1"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Lựa chọn 2"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu câu hỏi" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].options).toHaveLength(2);
  });
  it("stores learning objectives as an ordered list with explicit validation", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) }); vi.stubGlobal("fetch", fetch);
    render(<LessonObjectives lessonId="lesson" initialObjectives={["Read", "Write"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Đưa lên Mục tiêu 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu mục tiêu" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ learningObjectives: ["Write", "Read"] });
  });
  it.each(["TRUE_FALSE", "FILL_BLANK", "MATCHING", "ORDERING", "TRANSLATION", "WRITING", "PRONUNCIATION"] as const)("renders %s fields without requiring JSON", (type) => {
    const form = createQuestionForm(type);
    const view = render(<QuestionFields form={form} onChange={vi.fn()} errors={{}} />);
    expect(view.container.textContent).not.toMatch(/JSON/);
    expect(view.container.querySelector("input, select, textarea, button")).not.toBeNull();
  });
  it("keeps accepted answers distinct and supports case-sensitive authoring", () => {
    const form = createQuestionForm("FILL_BLANK");
    if (form.type !== "FILL_BLANK") throw new Error("Wrong form");
    form.prompt = "Fill"; form.content.answers = ["유", "yu"]; form.content.caseSensitive = true;
    expect(mapQuestionFormToPayload("exercise", form).content).toEqual({ answers: ["유", "yu"], caseSensitive: true });
  });
  it("keeps malformed legacy questions visible for recovery instead of crashing the editor", () => {
    render(<QuestionEditor exerciseId="exercise" question={{ id: "q", exerciseId: "exercise", type: "TRUE_FALSE", prompt: "Legacy", content: { correctAnswer: "true" }, audioUrl: null, correctAnswer: null, explanation: null, displayOrder: 0, options: [] }}
      busy={false} errors={{}} error={null} onErrors={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("giữ nguyên dữ liệu"); expect(screen.queryByRole("button", { name: "Lưu câu hỏi" })).toBeNull();
  });
  it("rejects malformed HTTP responses without a false save success", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("broken JSON"); } }); vi.stubGlobal("fetch", fetch);
    await expect(adminRequest("/api/admin/blocks", "POST", {})).rejects.toThrow(/Không đọc được phản hồi/);
  });
  it("locks pending mutations, preserves server state on failures, and reports committed writes when reload fails", async () => {
    const initial = [{ id: "old" }];
    function Harness() {
      const state = useAdminCollection(initial, "/list");
      return <><button disabled={state.busy} onClick={() => void state.mutate("/save", "POST", {})}>Save</button>
        <div data-testid="items">{state.items.map((item) => item.id).join(",")}</div><div role="alert">{state.error}</div><div role="status">{state.message}</div></>;
    }
    let rejectPending: ((reason: Error) => void) | undefined;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => { rejectPending = reject; })); vi.stubGlobal("fetch", fetch);
    render(<Harness />); const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save); fireEvent.click(save); expect(fetch).toHaveBeenCalledOnce(); expect(save).toHaveProperty("disabled", true);
    if (!rejectPending) throw new Error("Request missing"); rejectPending(new Error("Connection failed"));
    await waitFor(() => expect(save).toHaveProperty("disabled", false)); expect(screen.getByTestId("items").textContent).toBe("old");
    expect(screen.getByRole("status").textContent).toBe(""); expect(screen.getByRole("alert").textContent).toContain("Connection failed");
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { id: "new" } }) }).mockRejectedValueOnce(new Error("Reload failed"));
    fireEvent.click(save); await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Đã lưu thay đổi nhưng chưa tải lại"));
    expect(screen.getByTestId("items").textContent).toBe("old"); expect(screen.getByRole("status").textContent).toBe("Đã lưu thay đổi.");
  });
});
