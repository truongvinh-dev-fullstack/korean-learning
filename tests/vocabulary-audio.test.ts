import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getVocabularyAudioUrl } from "@/shared/audio/vocabulary-audio";
import recordings from "@/shared/audio/vocabulary-recordings.json";
import { AudioUrlSchema } from "@/shared/validation/audio-url";

describe("Vocabulary audio sources", () => {
  it("uses authored audio before related entries or bundled defaults", () => {
    expect(getVocabularyAudioUrl("물", "/audio/custom.ogg", [{ hangul: "물", audioUrl: "/audio/related.ogg" }])).toBe("/audio/custom.ogg");
    expect(getVocabularyAudioUrl("물", null, [{ hangul: "물", audioUrl: "/audio/related.ogg" }])).toBe("/audio/related.ogg");
    expect(getVocabularyAudioUrl("물")).toBe("/audio/vocab/mul.ogg");
  });
  it("matches complete Hangul words, normalizes Unicode, and never guesses ambiguous sources", () => {
    expect(getVocabularyAudioUrl(" 물 ".normalize("NFD"))).toBe("/audio/vocab/mul.ogg");
    expect(getVocabularyAudioUrl("물고기")).toBeNull();
    expect(getVocabularyAudioUrl("물", null, [{ hangul: "물", audioUrl: "/one.ogg" }, { hangul: "물", audioUrl: "/two.ogg" }])).toBeNull();
  });
  it("ships real OGG data with attribution for every bundled word", () => {
    expect(recordings.length).toBeGreaterThan(1);
    const attribution = readFileSync("public/audio/vocab/ATTRIBUTION.txt", "utf8");
    for (const recording of recordings) {
      expect(AudioUrlSchema.safeParse(recording.audioUrl).success).toBe(true);
      expect(readFileSync(`public${recording.audioUrl}`).subarray(0, 4).toString()).toBe("OggS");
      expect(attribution).toContain(recording.source);
      expect(attribution).toContain(recording.author);
      expect(attribution).toContain(recording.licenseUrl);
    }
  });
});
