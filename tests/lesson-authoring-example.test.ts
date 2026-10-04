import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import example from "../docs/examples/lesson-1-vowels.json";
import { LessonFormSchema, LessonBlockFormSchema, VocabularyFormSchema, ExerciseFormSchema, QuestionFormSchema } from "@/modules/admin/admin.schema";
import { validateLessonForPublish } from "@/modules/admin/lesson-publish";

describe("Complete lesson 1 example", () => {
  it("validates the actual API payloads, references and bundled audio", () => {
    expect(LessonFormSchema.safeParse(example.lesson).success).toBe(true);
    expect(example.lesson.learningObjectives).toHaveLength(4);
    for (const block of example.contentBlocks) expect(LessonBlockFormSchema.safeParse(block).success, block.type).toBe(true);
    for (const word of example.vocabulary) expect(VocabularyFormSchema.safeParse(word).success).toBe(true);
    for (const exercise of example.exercises) {
      expect(ExerciseFormSchema.safeParse(exercise).success).toBe(true);
      expect(exercise.questions).toHaveLength(4);
      for (const question of exercise.questions) expect(QuestionFormSchema.safeParse(question).success, question.type).toBe(true);
    }
    const hangul = example.contentBlocks.find((block) => block.type === "HANGUL")!;
    expect(hangul.content.characters).toHaveLength(10);
    expect(() => validateLessonForPublish({ ...example.lesson, blocks: example.contentBlocks, vocabularies: example.vocabulary, exercises: example.exercises })).not.toThrow();
    for (const path of ["/audio/vocab/ai.ogg", "/audio/lessons/korean-vowels.ogg", "/audio/exercises/vowel-a.ogg"]) expect(existsSync(`public${path}`)).toBe(true);
  });
});
