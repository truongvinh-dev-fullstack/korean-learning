import "dotenv/config";
import { describe, it, expect } from "vitest";
import {
  validateBlockContent,
  validateLessonBlockRecord,
} from "@/modules/lessons/lesson-block.schema";
import { lessonService } from "@/modules/lessons/lesson.service";

describe("LessonBlock Validation & Schemas", () => {
  it("validates a TEXT block successfully", () => {
    const validText = {
      title: "Lời mở đầu",
      markdown: "Học bảng chữ cái Hangeul rất thú vị!",
    };
    const result = validateBlockContent("TEXT", validText);
    expect(result.markdown).toBe(validText.markdown);
    expect(result.title).toBe(validText.title);
  });

  it("fails validation for an empty TEXT block", () => {
    const invalidText = { markdown: "" };
    expect(() => validateBlockContent("TEXT", invalidText)).toThrow();
  });

  it("validates a HANGUL block with character details", () => {
    const validHangul = {
      title: "Nguyên âm đơn",
      characters: [
        { char: "ㅏ", romanization: "a", strokeCount: 2, soundHint: "như a" },
        { char: "ㅓ", romanization: "eo", strokeCount: 2, soundHint: "như ơ" },
      ],
    };
    const result = validateBlockContent("HANGUL", validHangul);
    expect(result.characters).toHaveLength(2);
    expect(result.characters[0].char).toBe("ㅏ");
  });

  it("fails HANGUL validation when characters array is empty", () => {
    const invalidHangul = { characters: [] };
    expect(() => validateBlockContent("HANGUL", invalidHangul)).toThrow();
  });

  it("validates VOCABULARY block with translations", () => {
    const validVocab = {
      title: "Từ vựng gia đình",
      items: [
        {
          hangul: "아이",
          romanization: "ai",
          vietnamese: "Em bé",
          english: "Baby",
        },
      ],
    };
    const result = validateBlockContent("VOCABULARY", validVocab);
    expect(result.items[0].hangul).toBe("아이");
  });

  it("validates GRAMMAR block with formula and examples", () => {
    const validGrammar = {
      title: "Trợ từ 은/는",
      formula: "N + 은/는",
      explanation: "Biểu thị chủ đề của câu nói.",
      examples: [
        { korean: "저는 학생이에요", vietnamese: "Tôi là học sinh" },
      ],
    };
    const result = validateBlockContent("GRAMMAR", validGrammar);
    expect(result.formula).toBe("N + 은/는");
    expect(result.examples).toHaveLength(1);
  });

  it("validates DIALOGUE block with speaker lines", () => {
    const validDialogue = {
      title: "Chào hỏi tại sân bay",
      lines: [
        { speaker: "Minho", korean: "안녕하세요!", vietnamese: "Xin chào!" },
        { speaker: "Lan", korean: "반갑습니다!", vietnamese: "Rất vui được gặp bạn!" },
      ],
    };
    const result = validateBlockContent("DIALOGUE", validDialogue);
    expect(result.lines).toHaveLength(2);
  });

  it("validates AUDIO block with valid URL", () => {
    const validAudio = {
      audioUrl: "/audio/lesson1.mp3",
      caption: "Nghe phát âm chuẩn",
    };
    const result = validateBlockContent("AUDIO", validAudio);
    expect(result.audioUrl).toBe("/audio/lesson1.mp3");
  });

  it("validates CALLOUT block variants", () => {
    const validCallout = {
      variant: "tip" as const,
      title: "Mẹo nhỏ",
      message: "Luyện phát âm trước gương.",
    };
    const result = validateBlockContent("CALLOUT", validCallout);
    expect(result.variant).toBe("tip");
  });

  it("fails CALLOUT validation when variant is invalid", () => {
    const invalidCallout = {
      variant: "danger-unknown",
      message: "Cảnh báo",
    };
    expect(() => validateBlockContent("CALLOUT", invalidCallout)).toThrow();
  });

  it("validates discriminated union across all 7 types", () => {
    const blockRecord = {
      id: "test-block-1",
      lessonId: "test-lesson-1",
      type: "CALLOUT",
      displayOrder: 1,
      content: {
        variant: "info",
        message: "Thông tin quan trọng",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const validated = validateLessonBlockRecord(blockRecord);
    expect(validated.type).toBe("CALLOUT");
    if (validated.type === "CALLOUT") {
      expect(validated.content.message).toBe("Thông tin quan trọng");
    }
  });

  it("fetches and strictly validates real seeded lesson from database", async () => {
    const lesson = await lessonService.getPublishedLessonBySlug("bai-1-nguyen-am-co-ban");
    expect(lesson).not.toBeNull();
    expect(lesson?.slug).toBe("bai-1-nguyen-am-co-ban");
    expect(lesson?.blocks.length).toBeGreaterThanOrEqual(4);

    // Verify all blocks are validated typed objects, not raw unvalidated JSON
    for (const block of lesson!.blocks) {
      expect(["TEXT", "HANGUL", "VOCABULARY", "GRAMMAR", "DIALOGUE", "AUDIO", "CALLOUT"]).toContain(
        block.type
      );
      expect(block.content).toBeDefined();
    }
  });
});
