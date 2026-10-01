import { describe, expect, it } from "vitest";
import { QuestionFormSchema } from "@/modules/admin/admin.schema";

describe("F3 arrangement bank validation", () => {
  const question = (answer: string, tiles: string[]) => ({
    exerciseId: "exercise", type: "ARRANGE_SENTENCE", prompt: "Arrange", correctAnswer: answer,
    options: tiles.map((text) => ({ text, isCorrect: false })),
  });
  it.each([
    ["저는 학생입니다", ["학생입니다", "저는"], true],
    ["가 가", ["가", "가"], true],
    ["가 가", ["가"], false],
    ["가", [], false],
    ["가", [" "], false],
    ["저는 학생입니다", ["저는", "선생님입니다"], false],
    ["저는 학생입니다", ["저는 학생입니다", "물"], true],
    ["가", ["가"], true],
  ] as const)("validates %s with %j", (answer, tiles, valid) => {
    expect(QuestionFormSchema.safeParse(question(answer, [...tiles])).success).toBe(valid);
  });
});
