// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FlashcardRunner } from "@/components/srs/flashcard-runner";
import type { DueFlashcardItem } from "@/modules/srs/srs.service";

const card: DueFlashcardItem = {
  id: "card", vocabularyId: "word", hangul: "물", romanization: "mul", vietnameseMeaning: "Nước", englishMeaning: "Water",
  partOfSpeech: null, audioUrl: null, exampleSentenceHangul: null, exampleSentenceVi: null,
  lessonTitle: "Lesson", courseTitle: "Course", state: "NEW", intervalDays: 0, easeFactor: 2.5, repetitions: 0, dueAt: new Date(),
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const flip = () => fireEvent.keyDown(document.body, { key: " ", code: "Space" });
const good = () => screen.getByText("3").closest("button")!;

describe("F4 SRS retries", () => {
  it("reuses the pending review after commit/response loss, and advances on replay", async () => {
    const calls: { cardId: string; rating: string; idempotencyKey: string }[] = [];
    let saved: object;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); calls.push(body);
      if (calls.length === 1) { saved = { success: true, data: { cardId: body.cardId, rating: body.rating } }; throw new Error("Response lost after commit"); }
      return Response.json(saved);
    }));
    render(<FlashcardRunner initialCards={[card]} />);
    flip(); fireEvent.click(good());
    await screen.findByText("Response lost after commit");
    fireEvent.click(good());
    await waitFor(() => expect(screen.queryByText("Response lost after commit")).toBeNull());
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(screen.queryByText("3")).toBeNull();
  });
  it("blocks rapid clicks and changing the rating of an uncertain operation", async () => {
    const fetch = vi.fn(async () => { throw new Error("Uncertain"); }); vi.stubGlobal("fetch", fetch);
    render(<FlashcardRunner initialCards={[card]} />); flip();
    fireEvent.click(good()); fireEvent.click(good());
    await screen.findByText("Uncertain");
    fireEvent.click(screen.getByText("4").closest("button")!);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Đánh giá trước chưa được xác nhận/)).toBeDefined();
  });
});

describe("F5 native controls and global shortcuts", () => {
  it.each(["button", "a", "input", "textarea", "select", "editable", "aria"])("ignores Enter/Space from %s and descendants", (kind) => {
    render(<FlashcardRunner initialCards={[card]} />);
    const target = document.createElement(kind === "editable" || kind === "aria" ? "div" : kind);
    if (kind === "editable") target.setAttribute("contenteditable", "true");
    if (kind === "aria") target.setAttribute("role", "button");
    const child = document.createElement("span"); target.append(child); document.body.append(target);
    for (const key of ["Enter", " "]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      child.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
      expect(screen.queryByText("3")).toBeNull();
    }
    target.remove();
  });
  it("keeps body flip/number shortcuts while ignoring modifiers and inactive sessions", async () => {
    const fetch = vi.fn(async () => Response.json({ success: true, data: { cardId: card.id, rating: "GOOD" } })); vi.stubGlobal("fetch", fetch);
    const view = render(<FlashcardRunner initialCards={[card]} />);
    fireEvent.keyDown(document.body, { key: "Enter", ctrlKey: true });
    expect(screen.queryByText("3")).toBeNull();
    flip(); expect(good()).toBeDefined();
    fireEvent.keyDown(document.body, { key: "3" });
    await waitFor(() => expect(screen.queryByText("3")).toBeNull());
    expect(fireEvent.keyDown(document.body, { key: "Enter" })).toBe(true);
    view.unmount(); render(<FlashcardRunner initialCards={[]} />);
    expect(fireEvent.keyDown(document.body, { key: " " })).toBe(true);
  });
});
