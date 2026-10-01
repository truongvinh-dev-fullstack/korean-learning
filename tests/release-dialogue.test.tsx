// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LessonBlockRenderer } from "@/components/lessons/lesson-block-renderer";
import { validateLessonBlockRecord, DialogueBlockContentSchema } from "@/modules/lessons/lesson-block.schema";

afterEach(cleanup);
describe("F6 dialogue audio", () => {
  it.each([[true, false, 1], [false, true, 1], [true, true, 2], [false, false, 0]] as const)(
    "renders overall=%s and line=%s independently", (overall, line, count) => {
      const block = validateLessonBlockRecord({ id: "block", lessonId: "lesson", type: "DIALOGUE", displayOrder: 0, createdAt: new Date(), updatedAt: new Date(), content: {
        title: "Greeting", ...(overall ? { audioUrl: "/audio/lessons/korean-vowels.ogg" } : {}),
        lines: [
          { speaker: "Minho", korean: "안녕", vietnamese: "Chào", ...(line ? { audioUrl: "/audio/vocab/mul.ogg" } : {}) },
          { speaker: "Lan", korean: "네", vietnamese: "Vâng" },
        ],
      } });
      const view = render(<LessonBlockRenderer block={block} />);
      const players = [...view.container.querySelectorAll("audio")];
      expect(players).toHaveLength(count);
      for (const player of players) {
        expect(player.getAttribute("aria-label")).toBeTruthy();
        expect(player.controls).toBe(true);
        expect(player.autoplay).toBe(false);
      }
      if (line) expect(players.some((player) => player.getAttribute("aria-label")?.includes("Minho, câu 1"))).toBe(true);
    }
  );
  it.each(["javascript:alert(1)", "//evil.example/audio", "/../private", "data:audio/ogg;base64,abc"])("rejects unsafe line and overall URL %s", (audioUrl) => {
    const line = { speaker: "A", korean: "가", vietnamese: "A" };
    expect(DialogueBlockContentSchema.safeParse({ lines: [{ ...line, audioUrl }] }).success).toBe(false);
    expect(DialogueBlockContentSchema.safeParse({ lines: [line], audioUrl }).success).toBe(false);
  });
});
